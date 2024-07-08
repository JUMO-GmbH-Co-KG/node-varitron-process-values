/*!
 * @file   SystemVKey.hpp
 *
 * @brief  This Class wraps creation of a System V key. Because the System V keys are based on inodes,
 *         a file in the temp folder is created if necessary.
 *
 */

#pragma once

#include <sys/ipc.h>
#include <string>

class SystemVKey
{
public:
    explicit SystemVKey(const std::string &keyString, const char projectId);
    virtual ~SystemVKey();

    key_t getKey() const;
    std::string getKeyString() const;
    void cleanUpKey() const;
    static int getInvalidKey();

protected:
private:
    const std::string &getKeyBasePath() const;

    const std::string m_keyString;
    key_t m_key;
};
