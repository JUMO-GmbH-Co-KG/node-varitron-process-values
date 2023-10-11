/*!
 * @file   SystemVSemaphoreBaseClass.cpp
 *
 * @brief  This Class wraps basic functionality of a System V Semaphore
 *
 * @date   22.09.15
 *
 * @author Eugen Wiens
 *
 */

#include "SystemVSemaphoreBaseClass.hpp"

#include <sys/ipc.h>
#include <sys/sem.h>
#include <iostream>
#include <cstring>
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>

SystemVSemaphoreBaseClass::SemaphoreOptions SystemVSemaphoreBaseClass::sm_defaultSemaphoreOption = {0, 1, 0};

SystemVSemaphoreBaseClass::SystemVSemaphoreBaseClass(const std::string &keyString,
                                                     const CreationType creationType,
                                                     const int numberOfSemaphores,
                                                     SemaphoreOptions *const pSemaphoreOptions)
    : m_semaphoreId(getInvalidSemaphoreId()),
      m_creationType(creationType),
      m_numberOfSemaphores(numberOfSemaphores),
      m_systemVKey(keyString, 'S')
{
    if (m_creationType != CreationType::invalidObject)
    {
        switch (m_creationType)
        {
        case CreationType::attachToExistingLock:
            attachToExistingSemaphore(m_systemVKey.getKey());
            break;

        case CreationType::newLock:
            createSemaphore(m_systemVKey.getKey(), pSemaphoreOptions);
            break;

        default:
            std::cerr << " unknown creationType: " << static_cast<int>(m_creationType) << ". Ignore creation for key: " << m_systemVKey.getKey() << std::endl;
            break;
        }
    }
}

SystemVSemaphoreBaseClass::SystemVSemaphoreBaseClass(const std::string &keyString, const SystemVSemaphoreBaseClass::CreationType creationType)
    : SystemVSemaphoreBaseClass(keyString, creationType, 1, &sm_defaultSemaphoreOption)
{
}

SystemVSemaphoreBaseClass::~SystemVSemaphoreBaseClass()
{
    deleteSemaphoreSet();
}

bool SystemVSemaphoreBaseClass::isValid() const
{
    bool returnValue = false;

    if (m_semaphoreId >= 0)
    {
        returnValue = true;
    }

    return returnValue;
}

int SystemVSemaphoreBaseClass::getLastError() const
{
    return errno;
}

std::string SystemVSemaphoreBaseClass::getLastErrorAsString() const
{
    return std::string(strerror(errno));
}

bool SystemVSemaphoreBaseClass::createSemaphore(const key_t &key, SemaphoreOptions *const pSemaphoreOptions)
{
    bool returnValue = false;

    m_semaphoreId = semget(key, m_numberOfSemaphores, IPC_CREAT | IPC_EXCL | getAccessRights());

    if (m_semaphoreId >= 0)
    {
        if (pSemaphoreOptions != nullptr)
        {
            if (semop(m_semaphoreId, pSemaphoreOptions, m_numberOfSemaphores) == -1)
            {
                std::cerr << strerror(errno) << std::endl;
                deleteSemaphoreSet();
            }
            else
            {
                std::cout << "Create semaphore array with id " << m_semaphoreId << " and with the number of semaphores " << m_numberOfSemaphores << std::endl;
                returnValue = true;
            }
        }
        else
        {
            std::cerr << "SemaphoreOption pointer is null" << std::endl;
            deleteSemaphoreSet();
        }
    }
    else
    {
        std::cerr << "Cannot create semaphore for key " << key << std::endl;
        std::cerr << strerror(errno) << std::endl;
    }

    return returnValue;
}

bool SystemVSemaphoreBaseClass::attachToExistingSemaphore(const key_t &key)
{
    bool returnValue = false;

    m_semaphoreId = semget(key, m_numberOfSemaphores, 0);

    if (m_semaphoreId >= 0)
    {
        bool bReady = false;
        SemaphoreArguments arguments = {};
        SemaphoreArgumentsBuffer argumentBuffer;

        /* wait for other process to initialize the semaphore: */
        arguments.buf = &argumentBuffer;
        for (int i = 0; (i < getMaxRetries()) && (!bReady); i++)
        {
            semctl(m_semaphoreId, m_numberOfSemaphores - 1, IPC_STAT, arguments);
            if (arguments.buf->sem_otime != 0)
            {
                bReady = true;
            }
            else
            {
                sleep(1);
            }
        }

        if (!bReady)
        {
            errno = ETIME;
            std::cerr << "Not ready: " << strerror(errno) << std::endl;
        }
    }
    else
    {
        std::cerr << "semget: " << strerror(errno) << std::endl;
    }

    return returnValue;
}

bool SystemVSemaphoreBaseClass::setSemaphoreOptions(const SemaphoreOptions semaphoreOptions, const bool acceptTryAgain) const
{
    bool returnValue = false;

    if (isValid())
    {
        if (semop(m_semaphoreId, (struct sembuf *)&semaphoreOptions, 1) == -1)
        {
            if ((true == acceptTryAgain) && (EAGAIN == errno))
            {
                returnValue = true;
            }
            else
            {

                std::cerr << "Error: " << strerror(errno) << " id: " << m_semaphoreId << " num: " << semaphoreOptions.sem_num << " op: " << semaphoreOptions.sem_op << " value: " << semctl(m_semaphoreId, semaphoreOptions.sem_num, GETVAL, 0) << std::endl;
            }
        }
        else
        {
            returnValue = true;
        }
    }
    return returnValue;
}

void SystemVSemaphoreBaseClass::deleteSemaphoreSet()
{
    if (m_creationType == CreationType::newLock)
    {
        if (semctl(m_semaphoreId, 0, IPC_RMID) == -1)
        {
            std::cerr << "Error deleting semaphore: " << strerror(errno) << std::endl;
        }
        m_semaphoreId = getInvalidSemaphoreId();
        m_systemVKey.cleanUpKey();
    }
}

int SystemVSemaphoreBaseClass::getSemaphoreId() const
{
    return m_semaphoreId;
}

int SystemVSemaphoreBaseClass::getMaxRetries() const
{
    static const int maxRetries = 10;
    return maxRetries;
}

int SystemVSemaphoreBaseClass::getAccessRights() const
{
    static const int accessRights = 0666;
    return accessRights;
}

int SystemVSemaphoreBaseClass::getInvalidSemaphoreId() const
{
    static const int invalidSemaphoreId = -1;
    return invalidSemaphoreId;
}
