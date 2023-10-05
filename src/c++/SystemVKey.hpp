/*!
 * @file   SystemVKey.hpp
 *
 * @brief  This Class wraps creation of a System V key. Because the System V key are based on inodes,
 *         a file in temp folder is created if necessary.
 *
 * @date   04.05.16
 *
 * @author Eugen Wiens
 *
*/


#pragma once

#include <sys/ipc.h>

#include <QString>
#include <QChar>

class SystemVKey
{
public:
    explicit SystemVKey( const QString& keyString, const QChar& projectId);
    virtual ~SystemVKey();

    key_t getKey( void ) const;
    QString getKeyString( void ) const;
    void cleanUpKey( void ) const;
    static int getInvalidKey();
protected:

private:
    const QString& getKeyBasePath() const;

    const QString m_keyString;
    key_t m_key;
};


