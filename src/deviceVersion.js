import fs from 'fs';

const versionFilePath = '/jupiter/VersionFile.ini';

function getVersionString() {
    // [General]
    // Creator = "de-lxc-ewbuild01"
    // CreationDate = "2024-10-24 16:59:15.012703"
    // BuildType = "debug"
    // BspVersion = "4.2.4-32"

    // [MainVersion]
    // VersionString = "9.51"
    // VersionStringHash = "15-gcc26852e"
    const fileContent = fs.readFileSync(versionFilePath, 'utf-8');
    const versionLine = fileContent.match(/^VersionString\s*=\s*"(.+)"$/m);
    return versionLine ? versionLine[1] : '0.0';
}

export function getDeviceVersion() {
    // read version string and convert it to numbers or 0 if not a number
    // 9.51 => { major: 9, minor: 51 }
    const versionString = getVersionString();
    const [major, minor] = versionString.split('.').map(value => parseInt(value, 10) || 0);
    return { major, minor };
}

export function versionFileExists() {
    return fs.existsSync(versionFilePath);
}
