export type PackageInfo = {
    arch: string,
    pkgrel: string,
    pkgver: string,
    modifiedTime: number |  BigInt,
    epoch: number,
    files: string[]
    hasDebugSymbols?: boolean
}
export type Packages = {
    [pkgname: string]: PackageInfo[]
}
