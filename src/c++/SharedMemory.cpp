#include "SharedMemory.hpp"
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

void SharedMemory::init(Napi::Env env, Napi::Object &exports)
{
    Napi::Function func = DefineClass(env, "SharedMemory", {
                                                                InstanceMethod("writeByte", &SharedMemory::writeByte, napi_enumerable),
                                                                InstanceMethod("write", &SharedMemory::writeData, napi_enumerable),
                                                                InstanceMethod("readBuffer", &SharedMemory::readBuffer, napi_enumerable),
                                                                InstanceAccessor("buffer", &SharedMemory::readBuffer, &SharedMemory::setBuffer, napi_enumerable),
                                                            });

    auto constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);

    exports.Set("SharedMemory", func);
    env.SetInstanceData<Napi::FunctionReference>(constructor);
}

SharedMemory::SharedMemory(const Napi::CallbackInfo &info)
    : ObjectWrap(info), m_semaphoreLock(info[3].ToString().Utf8Value(), static_cast<SystemVSemaphoreBaseClass::CreationType>(info[4].ToNumber().Int32Value()))
{
    // CHECK_ARGS(napi_tools::string, napi_tools::number);
    std::string name = info[0].ToString().Utf8Value();

    m_size = info[1].ToNumber().Int32Value();
    if (m_size <= 0)
    {
        throw Napi::TypeError::New(info.Env(), "The buffer size must be greater than zero");
    }

    Value().DefineProperties({Napi::PropertyDescriptor::Value("size", Napi::Number::From(info.Env(), m_size),
                                                              napi_enumerable),
                              Napi::PropertyDescriptor::Value("name", info[0].ToString(),
                                                              napi_enumerable)});

    m_isDoubleBuffer = info[2].ToBoolean();

    int shmFileDescriptor = shm_open(name.c_str(), O_RDWR, 0666);

    #ifdef DEBUG
    std::cout << "(native) shmFileDescriptor " << shmFileDescriptor << " " << errno << endl;
    #endif

    if (shmFileDescriptor < 0)
    {
        throw Napi::Error::New(info.Env(), "Could not get the shared memory segment: " + getErrnoAsString());
    }

    const off_t offset = 0;
    m_buffer = static_cast<char *>(mmap(0, m_size, PROT_READ | PROT_WRITE, MAP_SHARED, shmFileDescriptor, offset));
    
    #ifdef DEBUG
    std::cout << "(native) buffer " << static_cast<void *>(buffer) << " " << errno << endl;
    #endif

    if (m_buffer == (char *)-1)
    {
        throw Napi::Error::New(info.Env(), "Could not attach the shared memory segment: " + getErrnoAsString());
    }

    Value().DefineProperty(Napi::PropertyDescriptor::Value("id", Napi::Number::From(info.Env(), name), napi_enumerable));
}

void SharedMemory::writeData(const Napi::CallbackInfo &info)
{
    if (info.Length() < 3 || !info[1].IsNumber() || !info[2].IsNumber())
    {
        throw Napi::TypeError::New(info.Env(), "writeValue requires a value, an offset, and a length as arguments");
    }

    size_t offset = info[1].As<Napi::Number>().Int64Value();
    size_t length = info[2].As<Napi::Number>().Int64Value();

    if (offset + length > this->m_size)
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

        // try to write value for maxWriteRetries times
        while (bRepetitionRequired && (counter <= maxWriteRetries))
        {
            if (m_semaphoreLock.lock())
            {
                memcpy(this->m_buffer + offset, buf.Data(), length);
                if (m_semaphoreLock.unlock())
                {
                    bRepetitionRequired = false;
                }
                else
                {
                    #ifdef DEBUG
                    std::cout << "C++: unable to unlock semaphore for writing" << std::endl;
                    #endif
                }
            }
            else
            {
                #ifdef DEBUG
                std::cout << "C++: unable to lock semaphore for writing" << std::endl;
                #endif
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

void SharedMemory::writeByte(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 3 || !info[0].IsNumber() || !info[1].IsBoolean() || !info[2].IsNumber())
    {
        Napi::TypeError::New(env, "writeBit requires a bitmask (number), a bit value (boolean), and an offset (number) as arguments").ThrowAsJavaScriptException();
        return;
    }

    uint8_t bitmask = info[0].As<Napi::Number>().Uint32Value();
    bool bitValue = info[1].As<Napi::Boolean>().Value();
    size_t offset = info[2].As<Napi::Number>().Uint32Value();

    if (offset >= this->m_size)
    {
        Napi::RangeError::New(env, "Offset exceeds buffer size").ThrowAsJavaScriptException();
        return;
    }
    
    unsigned int counter = 0;
    bool bRepetitionRequired = true;
    const unsigned int maxWriteRetries = 10;

    while (bRepetitionRequired && (counter <= maxWriteRetries))
    {
        if (m_semaphoreLock.lock())
        {
            uint8_t currentValue = this->m_buffer[offset];
            uint8_t newValue = bitValue ? (currentValue | bitmask) : (currentValue & ~bitmask);
            const size_t length = 1;
            memcpy(this->m_buffer + offset, &newValue, length);

            if (m_semaphoreLock.unlock())
            {
                bRepetitionRequired = false;
            }
            else
            {
                #ifdef DEBUG
                std::cout << "C++: unable to unlock semaphore for writing" << std::endl;
                #endif
            }
        }
        else
        {
            #ifdef DEBUG
            std::cout << "C++: unable to lock semaphore for writing" << std::endl;
            #endif
        }
        counter++;
    }
    if (bRepetitionRequired)
    {
        throw Napi::TypeError::New(info.Env(), "Unable to write value");
    }
}

Napi::Value SharedMemory::readBuffer(const Napi::CallbackInfo &info)
{
    ManagementBuffer *pManagmentBuffer = (ManagementBuffer *)m_buffer;
    Napi::Env env = info.Env();

    auto buf = Napi::Buffer<char>::New(info.Env(), this->m_size);
    const unsigned int maxReadRetries = 10;
    unsigned int counter = 0;
    bool bRepetitionRequired = true;

    if (m_isDoubleBuffer)
    {
        while (bRepetitionRequired && (counter <= maxReadRetries))
        {
            // ck_sequenz lock read
            auto m_version = ck_sequence_read_begin(&pManagmentBuffer->seqlock);

            // read value
            memcpy(buf.Data(), this->m_buffer, this->m_size);

            // read ck_sequenz again - if true read again
            bRepetitionRequired = ck_sequence_read_retry(&pManagmentBuffer->seqlock, m_version);
            counter++;
        }

        if (bRepetitionRequired)
        {
            throw Napi::Error::New(env, "Unable to read value");
        }

        // return buffer
        return buf.ToObject();
    }
    else
    {
        while (bRepetitionRequired && (counter <= maxReadRetries))
        {
            if (m_semaphoreLock.lock())
            {
                // read Value
                memcpy(buf.Data(), this->m_buffer, this->m_size);

                if (m_semaphoreLock.unlock())
                {
                    bRepetitionRequired = false;
                }
                else
                {
                    #ifdef DEBUG
                    std::cout << "read semaphore unlock failed" << std::endl;
                    #endif
                }
            }
            else
            {
                #ifdef DEBUG
                std::cout << "read semaphore lock failed" << std::endl;
                #endif
            }
            counter++;
        }

        if (bRepetitionRequired)
        {
            throw Napi::Error::New(env, "Unable to read value");
        }
        // return buffer
        return buf.ToObject();
    }
}

void SharedMemory::setBuffer(const Napi::CallbackInfo &info, const Napi::Value &value)
{
    if (!value.IsBuffer())
    {
        throw Napi::TypeError::New(info.Env(), "The buffer setter requires a buffer as an argument");
    }

    auto buf = info[0].As<Napi::Buffer<char>>();
    if (buf.Length() > this->m_size)
    {
        throw Napi::Error::New(info.Env(), "Could not write to the buffer: The input is bigger than the buffer size");
    }

    memcpy(this->m_buffer, buf.Data(), buf.Length());
}

SharedMemory::~SharedMemory()
{
    // detach from shared memory
    shmdt(this->m_buffer);
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports)
{
    SharedMemory::init(env, exports);
    return exports;
}

NODE_API_MODULE(SharedMemory, InitAll)