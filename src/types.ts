export type PackageInfo = {
    arch: string,
    pkgrel: string,
    pkgver: string,
    modifiedTime: number |  BigInt,
    epoch: number,
}
export type Packages = {
    [pkgname: string]: PackageInfo[]
}
