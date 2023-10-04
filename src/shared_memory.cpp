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

void shared_memory::init(Napi::Env env, Napi::Object &exports)
{
    Napi::Function func = DefineClass(env, "shared_memory", {
                                                                InstanceMethod("write", &shared_memory::writeData, napi_enumerable),
                                                                // InstanceMethod("read", &shared_memory::readString, napi_enumerable),
                                                                InstanceMethod("readBuffer", &shared_memory::readBuffer, napi_enumerable),
                                                                // InstanceAccessor("data", &shared_memory::readString, &shared_memory::setString, napi_enumerable),
                                                                InstanceAccessor("buffer", &shared_memory::readBuffer, &shared_memory::setBuffer, napi_enumerable),
                                                            });

    auto constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);

    exports.Set("shared_memory", func);
    env.SetInstanceData<Napi::FunctionReference>(constructor);
}

shared_memory::shared_memory(const Napi::CallbackInfo &info) : ObjectWrap(info)
{
    // CHECK_ARGS(napi_tools::string, napi_tools::number);
    global = info[2].IsBoolean() && info[2].ToBoolean().Value();

    std::string name = info[0].ToString().Utf8Value();

    size = info[1].ToNumber().Int64Value();
    if (size <= 0)
    {
        throw Napi::TypeError::New(info.Env(), "The buffer size must be greater than zero");
    }

    if (info[3].IsBoolean())
    {
        isHost = info[3].ToBoolean().Value();
    }
    else
    {
        isHost = true;
    }

    Value().DefineProperties({Napi::PropertyDescriptor::Value("size", Napi::Number::From(info.Env(), size),
                                                              napi_enumerable),
                              Napi::PropertyDescriptor::Value("name", info[0].ToString(),
                                                              napi_enumerable),
                              Napi::PropertyDescriptor::Value("host", Napi::Boolean::New(info.Env(), isHost),
                                                              napi_enumerable),
                              Napi::PropertyDescriptor::Value("global", Napi::Boolean::New(info.Env(), global),
                                                              napi_enumerable)});

    auto key = static_cast<key_t>(std::stol(name, nullptr, 16));

    if (isHost)
    {
        int id = shmget(key, size, IPC_CREAT | IPC_EXCL | SHM_R | SHM_W);
        if (id < 0)
        {
            throw Napi::Error::New(info.Env(), "Could not create the shared memory segment: " + getErrnoAsString());
        }
        else
        {
            extraInfo = std::make_shared<extra_info>(id);
        }

        buffer = static_cast<char *>(shmat(id, nullptr, SHM_R | SHM_W));
        // if (reinterpret_cast<intptr_t>(buffer) <= 0) // https://stackoverflow.com/questions/573294/when-to-use-reinterpret-cast
        if (buffer == (char *)-1)
        {
            throw Napi::Error::New(info.Env(), "Could not attach the shared memory segment: " + getErrnoAsString());
        }
    }
    else
    {
        // int id = shmget(key, size, SHM_R | SHM_W);
        int id = shm_open((const char *)key, size, SHM_R);
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
    }

    Value().DefineProperty(Napi::PropertyDescriptor::Value("id", Napi::Number::From(info.Env(), key), napi_enumerable));
}

void shared_memory::writeData(const Napi::CallbackInfo &info)
{
    // CHECK_ARGS(napi_tools::string | napi_tools::buffer);
    std::vector<char> data;
    if (info[0].IsBuffer())
    {
        auto buf = info[0].As<Napi::Buffer<char>>();
        data = std::vector<char>(buf.Data(), buf.Data() + buf.Length());
    }
    else
    {
        std::string string = info[0].ToString();
        data = std::vector<char>(string.begin(), string.end());

        if (string.size() < this->size)
        {
            this->buffer[string.size()] = '\0';
        }
    }

    if (data.size() > this->size)
    {
        throw Napi::Error::New(info.Env(), "Could not write to the buffer: The input is bigger than the buffer size");
    }

    memcpy(this->buffer, data.data(), data.size());
}

// Napi::Value shared_memory::readString(const Napi::CallbackInfo &info) {
//     std::string res(std::min(strlen(this->buffer), this->size), '\0');
//     memcpy(res.data(), this->buffer, res.size());

//     return Napi::String::New(info.Env(), res);
// }

Napi::Value shared_memory::readBuffer(const Napi::CallbackInfo &info)
{
    auto buf = Napi::Buffer<char>::New(info.Env(), this->size);
    memcpy(buf.Data(), this->buffer, this->size);

    return buf.ToObject();
}

// void shared_memory::setString(const Napi::CallbackInfo &info, const Napi::Value &value) {
//     if (!value.IsString()) {
//         throw Napi::TypeError::New(info.Env(), "The string setter requires a string as an argument");
//     }

//     std::string data = value.ToString();
//     if (data.size() > this->size) {
//         throw Napi::Error::New(info.Env(), "Could not write to the buffer: The input is bigger than the buffer size");
//     }

//     if (data.size() < this->size) {
//         this->buffer[data.size()] = '\0';
//     }

//     memcpy(this->buffer, data.c_str(), data.size());
// }

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
    if (this->isHost)
    {
        shmctl(this->extraInfo->id, IPC_RMID, nullptr);
    }
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports)
{
    shared_memory::init(env, exports);
    return exports;
}

NODE_API_MODULE(shared_memory, InitAll)