/*!
 * @file   SystemVSemaphore.hpp
 *
 * @brief  This Class abstracts the System V Semaphore
 *
 */

#pragma once

#include "SystemVSemaphoreBaseClass.hpp"

class SystemVSemaphore : public SystemVSemaphoreBaseClass
{
public:
    using SystemVSemaphoreBaseClass::SystemVSemaphoreBaseClass;

    bool lock(void) const;
    bool unlock(void) const;
    int getValue(void) const;
};
