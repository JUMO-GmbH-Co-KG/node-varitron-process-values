/*!
 * @file   SystemVSemaphore.hpp
 *
 * @brief  This Class abstracts the System V Semaphore
 *
 * @date   21.09.15
 *
 * @author Eugen Wiens
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
