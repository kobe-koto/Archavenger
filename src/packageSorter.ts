import type { ExtendedPackageInfo, PackageInfo } from "./types.ts";
export const packageSorter = (
    a: ExtendedPackageInfo | PackageInfo,
    b: ExtendedPackageInfo | PackageInfo
) => {
    // Implementation for sorting packages (from old to new)
    // epoch > pkgver > pkgrel
    // assuming modifiedTime (BigInts) is not reliable.... it is, but keep it for fallback
    if (a.epoch !== b.epoch) {
        return a.epoch - b.epoch;
    }
    if (a.pkgver !== b.pkgver) {
        return a.pkgver.localeCompare(b.pkgver);
    }
    if (a.pkgrel !== b.pkgrel) {
        const aNum = parseInt(a.pkgrel);
        const bNum = parseInt(b.pkgrel);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }
        return a.pkgrel.localeCompare(b.pkgrel);
    }
    if ("modifiedTime" in a && "modifiedTime" in b) {
        if (a.modifiedTime < b.modifiedTime) return -1;
        if (a.modifiedTime > b.modifiedTime) return 1;
    }
    return 0;
}
