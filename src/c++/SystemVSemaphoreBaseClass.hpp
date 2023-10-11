/*!
 * @file   SystemVSemaphoreBaseClass.hpp
 *
 * @brief  This Class wraps basic functionality of a System V Semaphore. Additionally, this module takes care of the needed iNode to create a token key for the System V mechanisms.
 *
 * @date   22.09.15
 *
 * @author Eugen Wiens
 *
 */

#pragma once

#include "SystemVKey.hpp"

#include <string>
#include <sys/types.h>

class SystemVSemaphoreBaseClass
{
public:
    using SemaphoreOptions = struct sembuf;

    enum class CreationType
    {
        attachToExistingLock,
        newLock,
        invalidObject
    };

    explicit SystemVSemaphoreBaseClass(const std::string &keyString,
                                       const CreationType creationType,
                                       const int numberOfSemaphores,
                                       SemaphoreOptions *const pSemaphoreOptions);
    explicit SystemVSemaphoreBaseClass(const std::string &keyString, const CreationType creationType);
    SystemVSemaphoreBaseClass(const SystemVSemaphoreBaseClass &other) = delete;

    virtual ~SystemVSemaphoreBaseClass();

    SystemVSemaphoreBaseClass &operator=(const SystemVSemaphoreBaseClass &other) = delete;

    bool isValid() const;
    int getLastError() const;
    std::string getLastErrorAsString() const;

protected:
    union semun
    {
        int val;
        struct semid_ds *buf;
        unsigned short *array;
    };

    using SemaphoreArguments = union semun;
    using SemaphoreArgumentsBuffer = struct semid_ds;

    bool createSemaphore(const key_t &key, SemaphoreOptions *const pSemaphoreOptions);
    bool attachToExistingSemaphore(const key_t &key);
    key_t createKeyFromKeyString();
    bool setSemaphoreOptions(const SemaphoreOptions semaphoreOptions, const bool acceptTryAgain = false) const;
    void deleteSemaphoreSet();
    int getSemaphoreId() const;

private:
    int getMaxRetries() const;
    int getAccessRights() const;
    int getInvalidSemaphoreId() const;

    int m_semaphoreId;
    CreationType m_creationType;
    int m_numberOfSemaphores;
    SystemVKey m_systemVKey;

    static SemaphoreOptions sm_defaultSemaphoreOption;
};
