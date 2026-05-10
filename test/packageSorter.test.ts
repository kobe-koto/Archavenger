import { describe, expect, test } from "bun:test";
import { packageSorter } from "../src/packageSorter.ts";
import type { PackageInfo } from "../src/types.ts";

const pkg = (pkgver: string, pkgrel = "1", epoch = 0): PackageInfo => ({
    arch: "x86_64",
    epoch,
    pkgrel,
    pkgver,
});

const sortVersions = (packages: PackageInfo[]) =>
    packages.sort(packageSorter).map(({ epoch, pkgver, pkgrel }) => `${epoch}:${pkgver}-${pkgrel}`);

describe("packageSorter", () => {
    test("sorts package releases using pacman numeric version semantics", () => {
        expect(sortVersions([
            pkg("1.0", "10"),
            pkg("1.0", "1"),
            pkg("1.0", "2"),
        ])).toEqual([
            "0:1.0-1",
            "0:1.0-2",
            "0:1.0-10",
        ]);
    });

    test("sorts package versions from old to new instead of lexicographically", () => {
        expect(sortVersions([
            pkg("10"),
            pkg("1"),
            pkg("2"),
        ])).toEqual([
            "0:1-1",
            "0:2-1",
            "0:10-1",
        ]);
    });

    test("handles alpha suffixes, separators, and epochs like alpm_pkg_vercmp", () => {
        expect(sortVersions([
            pkg("1.0", "1", 1),
            pkg("1.0"),
            pkg("1.0_1"),
            pkg("1.0rc"),
        ])).toEqual([
            "0:1.0rc-1",
            "0:1.0-1",
            "0:1.0_1-1",
            "1:1.0-1",
        ]);
    });

    test("sorts snapshot-style versions by numeric suffix", () => {
        expect(sortVersions([
            pkg("r10.abcdef12"),
            pkg("r2.abcdef12"),
            pkg("r1.abcdef12"),
        ])).toEqual([
            "0:r1.abcdef12-1",
            "0:r2.abcdef12-1",
            "0:r10.abcdef12-1",
        ]);
    });

    test("sorts dotted versions with snapshot suffixes", () => {
        expect(sortVersions([
            pkg("1.2.3.r10.abcdef12"),
            pkg("1.2.3.r2.abcdef12"),
            pkg("1.2.3.r1.abcdef12"),
            pkg("1.2.10.r1.abcdef12"),
        ])).toEqual([
            "0:1.2.3.r1.abcdef12-1",
            "0:1.2.3.r2.abcdef12-1",
            "0:1.2.3.r10.abcdef12-1",
            "0:1.2.10.r1.abcdef12-1",
        ]);
    });
});
