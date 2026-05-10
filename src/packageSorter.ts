import type { ExtendedPackageInfo, PackageInfo } from "./types.ts";

const isDigit = (char: string | undefined) => char !== undefined && char >= "0" && char <= "9";
const isAlpha = (char: string | undefined) =>
    char !== undefined && ((char >= "A" && char <= "Z") || (char >= "a" && char <= "z"));
const isAlphaNumeric = (char: string | undefined) => isDigit(char) || isAlpha(char);

const compareStrings = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const parseEvr = (evr: string) => {
    let s = 0;
    while (isDigit(evr[s])) s++;

    const releaseSeparator = evr.lastIndexOf("-");
    const hasRelease = releaseSeparator >= s;
    const epoch = evr[s] === ":" ? evr.slice(0, s) || "0" : "0";
    const versionStart = evr[s] === ":" ? s + 1 : 0;

    return {
        epoch,
        version: hasRelease ? evr.slice(versionStart, releaseSeparator) : evr.slice(versionStart),
        release: hasRelease ? evr.slice(releaseSeparator + 1) : undefined,
    };
};

const rpmVersionCompare = (a: string, b: string): number => {
    if (a === b) return 0;

    let one = 0;
    let two = 0;

    while (one < a.length && two < b.length) {
        const ptrOne = one;
        const ptrTwo = two;

        while (one < a.length && !isAlphaNumeric(a[one])) one++;
        while (two < b.length && !isAlphaNumeric(b[two])) two++;

        if (!(one < a.length && two < b.length)) break;

        const separatorLengthA = one - ptrOne;
        const separatorLengthB = two - ptrTwo;
        if (separatorLengthA !== separatorLengthB) {
            return separatorLengthA < separatorLengthB ? -1 : 1;
        }

        const segmentStartA = one;
        const segmentStartB = two;
        const isNumeric = isDigit(a[one]);

        if (isNumeric) {
            while (one < a.length && isDigit(a[one])) one++;
            while (two < b.length && isDigit(b[two])) two++;
        } else {
            while (one < a.length && isAlpha(a[one])) one++;
            while (two < b.length && isAlpha(b[two])) two++;
        }

        let segmentA = a.slice(segmentStartA, one);
        let segmentB = b.slice(segmentStartB, two);

        if (segmentB.length === 0) {
            return isNumeric ? 1 : -1;
        }

        if (isNumeric) {
            segmentA = segmentA.replace(/^0+/, "");
            segmentB = segmentB.replace(/^0+/, "");

            if (segmentA.length !== segmentB.length) {
                return segmentA.length > segmentB.length ? 1 : -1;
            }
        }

        const segmentCompare = compareStrings(segmentA, segmentB);
        if (segmentCompare !== 0) return segmentCompare;
    }

    if (one === a.length && two === b.length) return 0;

    if ((one === a.length && !isAlpha(b[two])) || isAlpha(a[one])) {
        return -1;
    }
    return 1;
};

const alpmPackageVersionCompare = (a: string, b: string): number => {
    if (a === b) return 0;

    const evrA = parseEvr(a);
    const evrB = parseEvr(b);

    const epochCompare = rpmVersionCompare(evrA.epoch, evrB.epoch);
    if (epochCompare !== 0) return epochCompare;

    const versionCompare = rpmVersionCompare(evrA.version, evrB.version);
    if (versionCompare !== 0) return versionCompare;

    if (evrA.release !== undefined && evrB.release !== undefined) {
        return rpmVersionCompare(evrA.release, evrB.release);
    }
    return 0;
};

export const packageSorter = (
    a: ExtendedPackageInfo | PackageInfo,
    b: ExtendedPackageInfo | PackageInfo
) => {
    return alpmPackageVersionCompare(
        `${a.epoch}:${a.pkgver}-${a.pkgrel}`,
        `${b.epoch}:${b.pkgver}-${b.pkgrel}`
    );
}
