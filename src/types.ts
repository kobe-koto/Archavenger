export type PackageInfo = {
    arch: string,
    pkgrel: string,
    pkgver: string,
    epoch: number,
    hasDebugSymbols?: boolean
}
export type ExtendedPackageInfo = PackageInfo & {
    modifiedTime: number |  BigInt,
    files: string[]
}
export type Packages = {
    [pkgname: string]: PackageInfo[]
}
export type ExtendedPackages = {
    [pkgname: string]: ExtendedPackageInfo[]
}
export type OperationResult = {
    status: "success" | "error" | "warning" | "skipped",
    message: string,
    details?: any
}