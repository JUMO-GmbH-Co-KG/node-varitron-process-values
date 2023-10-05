/*!
 * @file   SystemVSemaphore.cpp
 *
 * @brief  This Class abstracts the System V Semaphore
 *
 * @date   21.09.15
 *
 * @author Eugen Wiens
 *
*/

#include "SystemVSemaphore.hpp"

#include <sys/ipc.h>
#include <sys/sem.h>

bool SystemVSemaphore::lock(void) const
{
    const SemaphoreOptions semaphoreLock = { 0, -1, 0 };

    return setSemaphoreOptions( semaphoreLock );
}

bool SystemVSemaphore::unlock(void) const
{
    const SemaphoreOptions semaphoreUnlock = { 0, 1, 0 };

    return setSemaphoreOptions( semaphoreUnlock );
}

int SystemVSemaphore::getValue(void) const
{
    return semctl(getSemaphoreId(), 0, GETVAL, 0);
}
