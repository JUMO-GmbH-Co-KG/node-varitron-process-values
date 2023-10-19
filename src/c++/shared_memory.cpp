#include "shared_memory.hpp"
#include <v8.h>
#include <node.h>
#include <node_buffer.h>
#include <iostream>
#include <fstream>
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <string>
#include <cstring>

#include <unistd.h>
#include <semaphore.h>
#include <errno.h>
#include <sys/types.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <sys/fcntl.h>

#include <ck_sequence.h>

using namespace v8;
using namespace std;

std::string getErrnoAsString()
{
    return strerror(errno);
}

class shared_memory::extra_info
{
public:
    explicit extra_info(int id) : id(id) {}

    int id;
};

enum class ActiveBuffer
{
    buffer1,
    buffer2
};

struct ManagementBuffer
{
    ActiveBuffer activeReadBuffer;
    ActiveBuffer activeWriteBuffer;
    ck_sequence_t seqlock;
};

void shared_memory::init(Napi::Env env, Napi::Object &exports)
{
    Napi::Function func = DefineClass(env, "shared_memory", {
                                                                InstanceMethod("write", &shared_memory::writeData, napi_enumerable),
                                                                // InstanceMethod("read", &shared_memory::readString, napi_enumerable),
                                                                InstanceMethod("readBuffer", &shared_memory::readBuffer, napi_enumerable),
                                                                InstanceAccessor("buffer", &shared_memory::readBuffer, &shared_memory::setBuffer, napi_enumerable),
                                                            });

    auto constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);

    exports.Set("shared_memory", func);
    env.SetInstanceData<Napi::FunctionReference>(constructor);
}

shared_memory::shared_memory(const Napi::CallbackInfo &info)
    : ObjectWrap(info), m_semaphoreLock(info[3].ToString().Utf8Value(), static_cast<SystemVSemaphoreBaseClass::CreationType>(info[4].ToNumber().Int32Value()))
{
    // CHECK_ARGS(napi_tools::string, napi_tools::number);
    std::string name = info[0].ToString().Utf8Value();

    size = info[1].ToNumber().Int32Value();
    if (size <= 0)
    {
        throw Napi::TypeError::New(info.Env(), "The buffer size must be greater than zero");
    }

    Value().DefineProperties({Napi::PropertyDescriptor::Value("size", Napi::Number::From(info.Env(), size),
                                                              napi_enumerable),
                              Napi::PropertyDescriptor::Value("name", info[0].ToString(),
                                                              napi_enumerable)});

    auto key = static_cast<key_t>(std::stol(name, nullptr, 16));

    doublebuffer = info[2].ToBoolean();

    int id = shmget(key, size, SHM_R | SHM_W);
    std::cout << "(native) shmId " << id << " " << errno << endl;
    if (id < 0)
    {
        throw Napi::Error::New(info.Env(), "Could not get the shared memory segment: " + getErrnoAsString());
    }
    else
    {
        extraInfo = std::make_shared<extra_info>(id);
    }

    buffer = static_cast<char *>(shmat(id, nullptr, 0));
    std::cout << "(native) buffer " << static_cast<void *>(buffer) << " " << errno << endl;
    // if (reinterpret_cast<intptr_t>(buffer) <= 0) // https://stackoverflow.com/questions/573294/when-to-use-reinterpret-cast
    if (buffer == (char *)-1)
    {
        throw Napi::Error::New(info.Env(), "Could not attach the shared memory segment: " + getErrnoAsString());
    }

    Value().DefineProperty(Napi::PropertyDescriptor::Value("id", Napi::Number::From(info.Env(), key), napi_enumerable));
}

void shared_memory::writeData(const Napi::CallbackInfo &info)
{
    if (info.Length() < 3 || !info[1].IsNumber() || !info[2].IsNumber())
    {
        throw Napi::TypeError::New(info.Env(), "writeValue requires a value, an offset, and a length as arguments");
    }

    size_t offset = info[1].As<Napi::Number>().Int64Value();
    size_t length = info[2].As<Napi::Number>().Int64Value();

    if (offset < 0 || offset + length > this->size)
    {
        throw Napi::RangeError::New(info.Env(), "Offset and length exceed buffer size");
    }

    if (info[0].IsBuffer())
    {
        auto buf = info[0].As<Napi::Buffer<char>>();
        if (buf.Length() != length)
        {
            throw Napi::RangeError::New(info.Env(), "Value buffer length does not match the specified length");
        }

        unsigned int counter = 0;
        bool bRepetitionRequired = true;
        const unsigned int maxWriteRetries = 10;

        while (bRepetitionRequired && (counter <= maxWriteRetries))
        {
            // semaphore lock
            if (m_semaphoreLock.lock())
            {

                memcpy(this->buffer + offset, buf.Data(), length);

                // semaphore unlock
                if (m_semaphoreLock.unlock())
                {
                    bRepetitionRequired = false;
                }
                else
                {
                    std::cout << "C++: unable to unlock semaphore for writing" << std::endl;
                }
            }
            else
            {
                std::cout << "C++: unable to lock semaphore for writing" << std::endl;
            }
            counter++;
        }
        if (bRepetitionRequired)
        {
            throw Napi::TypeError::New(info.Env(), "Unable to write value");
        }
    }
    else
    {
        throw Napi::TypeError::New(info.Env(), "Value must be a buffer");
    }
}

Napi::Value shared_memory::readBuffer(const Napi::CallbackInfo &info)
{
    ManagementBuffer *pManagmentBuffer = (ManagementBuffer *)buffer;
    Napi::Env env = info.Env();

    auto buf = Napi::Buffer<char>::New(info.Env(), this->size);
    const unsigned int maxReadRetries = 10;
    unsigned int counter = 0;
    bool bRepetitionRequired = true;

    if (doublebuffer)
    {

        while (bRepetitionRequired && (counter <= maxReadRetries))
        {
            // ck_sequenz lock read
            auto m_version = ck_sequence_read_begin(&pManagmentBuffer->seqlock);

            // read value
            memcpy(buf.Data(), this->buffer, this->size);

            // read ck_sequenz again - if true read again
            bRepetitionRequired = ck_sequence_read_retry(&pManagmentBuffer->seqlock, m_version);
            counter++;
        }

        if (bRepetitionRequired)
        {
            throw Napi::Error::New(env, "C++: can not read value.");
        }

        // return buffer
        return buf.ToObject();
    }
    else
    {

        while (bRepetitionRequired && (counter <= maxReadRetries))
        {

            // semaphore lock
            if (m_semaphoreLock.lock())
            {

                // read Value
                memcpy(buf.Data(), this->buffer, this->size);

                if (m_semaphoreLock.unlock())
                {
                    bRepetitionRequired = false;
                }
                else
                {
                    std::cout << "read semaphore unlock failed" << std::endl;
                }
            }
            else
            {
                std::cout << "read semaphore lock failed" << std::endl;
            }
            counter++;
        }

        if (bRepetitionRequired)
        {
            throw Napi::Error::New(env, "C++: can not read value.");
        }
        // return buffer
        return buf.ToObject();
    }
}

void shared_memory::setBuffer(const Napi::CallbackInfo &info, const Napi::Value &value)
{
    if (!value.IsBuffer())
    {
        throw Napi::TypeError::New(info.Env(), "The buffer setter requires a buffer as an argument");
    }

    auto buf = info[0].As<Napi::Buffer<char>>();
    if (buf.Length() > this->size)
    {
        throw Napi::Error::New(info.Env(), "Could not write to the buffer: The input is bigger than the buffer size");
    }

    memcpy(this->buffer, buf.Data(), buf.Length());
}

shared_memory::~shared_memory()
{
    shmdt(this->buffer);
    // shmctl(this->extraInfo->id, IPC_RMID, nullptr);
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports)
{
    shared_memory::init(env, exports);
    return exports;
}

NODE_API_MODULE(shared_memory, InitAll)