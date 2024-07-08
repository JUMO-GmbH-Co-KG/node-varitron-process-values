/*!
 * @file   SystemVKey.cpp
 *
 * @brief  This Class wraps creation of a System V key. Because the System V keys are based on inodes,
 *         a file in the temp folder is created if necessary.
 *
 */

#include "SystemVKey.hpp"

#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <cstring>
#include <iostream>

SystemVKey::SystemVKey(const std::string &keyString, const char projectId)
    : m_keyString(keyString), m_key(-1)
{
    std::string filePath = getKeyBasePath() + m_keyString;

    int fileDescriptor = open(filePath.c_str(), O_CREAT | O_RDWR, S_IRUSR | S_IWUSR);

    if (fileDescriptor == -1)
    {
        std::cerr << "Cannot open file: " << filePath << std::endl;
    }
    close(fileDescriptor);

    m_key = ftok(filePath.c_str(), static_cast<int>(projectId));
    if (m_key == -1)
    {
        std::cerr << "Cannot create key ftok: " << strerror(errno) << std::endl;
    }
}

SystemVKey::~SystemVKey()
{
}

key_t SystemVKey::getKey() const
{
    return m_key;
}

std::string SystemVKey::getKeyString() const
{
    return m_keyString;
}

void SystemVKey::cleanUpKey() const
{
    std::string filePath = getKeyBasePath() + m_keyString;
    if (unlink(filePath.c_str()) != 0)
    {
        std::cerr << "Cannot remove file: " << filePath << std::endl;
    }
}

key_t SystemVKey::getInvalidKey()
{
    static const key_t invalidKey = -1;
    return invalidKey;
}

const std::string &SystemVKey::getKeyBasePath() const
{
#ifdef DESKTOP_BUILD
    static const std::string keyBasePath = "/tmp/";
#else
    static const std::string keyBasePath = "/jupiter/tmp/";
#endif
    if (mkdir(keyBasePath.c_str(), S_IRWXU) != 0 && errno != EEXIST)
    {
        std::cerr << "Cannot create directory: " << keyBasePath << std::endl;
    }

    return keyBasePath;
}
