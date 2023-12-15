/*!
 * @file   SharedMemory.hpp
 *
 * @brief  This class wraps the attach to a shared memory block. It also provides methods to write and read data.
 *
 */

#pragma once

#include <memory>
#include <string>
#include <napi.h>

#include "SystemVSemaphore.hpp"

/**
 * The shared memory node wrapper class
 */
class SharedMemory : public Napi::ObjectWrap<SharedMemory>
{
public:
    /**
     * Initialize the class
     *
     * @param env the environment
     * @param exports the exports
     */
    static void init(Napi::Env env, Napi::Object &exports);

    /**
     * Create a SharedMemory instance
     *
     * @param info the callback info
     */
    explicit SharedMemory(const Napi::CallbackInfo &info);

    /**
     * Write data to the memory block
     *
     * @param info the callback info
     */
    void writeData(const Napi::CallbackInfo &info);

    /**
     * Write data byte to the memory block
     *
     * @param info the callback info
     */
    void writeByte(const Napi::CallbackInfo &info);

    /**
     * Copy a node buffer to the memory block
     *
     * @param info the callback info
     * @param value the data to copy
     */
    void setBuffer(const Napi::CallbackInfo &info, const Napi::Value &value);

    /**
     * Read data into a node buffer from the memory block
     *
     * @param info the callback info
     * @return the read data
     */
    Napi::Value readBuffer(const Napi::CallbackInfo &info);

    /**
     * Destroy the shared memory instance
     */
    ~SharedMemory() override;

private:
    // Properties and pointer of the memory block
    size_t m_size;
    char *m_buffer;
    bool m_isDoubleBuffer;

    SystemVSemaphore m_semaphoreLock;
};
