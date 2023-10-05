/*!
 * @file   SystemVKey.cpp
 *
 * @brief  This Class wraps creation of a System V key. Because the System V key are based on inodes,
 *         a file in temp folder is created if necessary.
 *
 * @date   04.05.16
 *
 * @author Eugen Wiens
 *
*/

#include "SystemVKey.hpp"
#include "PropertyManagerConst.hpp"

#include <QFile>
#include <QDebug>
#include <QDir>


SystemVKey::SystemVKey(const QString &keyString, const QChar &projectId)
    : m_keyString(keyString), m_key(-1)
{
    QFile file( getKeyBasePath() + m_keyString );

    if( false == file.exists() )
    {
        if( false == file.open(QFile::WriteOnly) )
        {
            qCritical() << "Cannot open file: " << file.fileName();
        }
        file.close();
    }
    m_key = ftok(qPrintable(file.fileName()), static_cast<int>(projectId.unicode()));
    if( m_key == -1)
    {
        qCritical() << "Cannot create key ftok: " << strerror(errno);
    }
}

SystemVKey::~SystemVKey()
{
}

key_t SystemVKey::getKey( void ) const
{
    return m_key;
}

QString SystemVKey::getKeyString() const
{
    return m_keyString;
}

void SystemVKey::cleanUpKey() const
{
    QFile file( getKeyBasePath() + m_keyString );
    if( false == file.remove() )
    {
        qCritical() << "Cannot remove file: " << file.fileName();
    }
}

int SystemVKey::getInvalidKey()
{
    static const int invalidKey = -1;
    return invalidKey;
}

const QString &SystemVKey::getKeyBasePath() const
{
    static const QString keyBasePath = PropertyManagerConst::getJupiterTemporaryFolderPath();

    QDir dirRoot(QStringLiteral("/"));
    if (dirRoot.mkpath(keyBasePath) == false)
    {
        qWarning() << "Can not make directory:" << keyBasePath;
    }

    return keyBasePath;
}
