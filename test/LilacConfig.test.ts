import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLilacConfigs } from "../src/utils/LilacConfig.ts";

const createTempDir = (): string =>
    fs.mkdtempSync(path.join(os.tmpdir(), "archavenger-lilac-"));

const seedPkgDir = (
    parent: string,
    pkgDir: string,
    files: Record<string, string>,
): string => {
    const dir = path.join(parent, pkgDir);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), content);
    }
    return dir;
};

describe("readLilacConfigs", () => {
    let tmp: string;

    beforeEach(() => {
        tmp = createTempDir();
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test("extracts a scalar pkgname from PKGBUILD", () => {
        seedPkgDir(tmp, "foo", {
            PKGBUILD: "pkgname=foo\npkgver=1.0\n",
            "lilac.yaml": "build_prefix: extra-x86_64\n",
        });

        expect(readLilacConfigs([tmp])).toEqual(["foo"]);
    });

    test("extracts pkgname when quoted in PKGBUILD", () => {
        seedPkgDir(tmp, "foo", {
            PKGBUILD: "pkgname=\"foo\"\npkgver=1.0\n",
            "lilac.yaml": "build_prefix: extra-x86_64\n",
        });
        seedPkgDir(tmp, "bar", {
            PKGBUILD: "pkgname='bar'\npkgver=1.0\n",
            "lilac.yml": "build_prefix: extra-x86_64\n",
        });

        expect(readLilacConfigs([tmp]).sort()).toEqual(["bar", "foo"]);
    });

    test("extracts an array pkgname (split-package) from PKGBUILD", () => {
        seedPkgDir(tmp, "split", {
            PKGBUILD: "pkgname=(\n  alpha\n  beta\n  gamma\n)\npkgver=1.0\n",
            "lilac.yaml": "build_prefix: extra-x86_64\n",
        });

        expect(readLilacConfigs([tmp])).toEqual(["alpha", "beta", "gamma"]);
    });

    test("extracts an inline array pkgname", () => {
        seedPkgDir(tmp, "split", {
            PKGBUILD: "pkgname=(alpha beta gamma)\npkgver=1.0\n",
            "lilac.yaml": "build_prefix: extra-x86_64\n",
        });

        expect(readLilacConfigs([tmp])).toEqual(["alpha", "beta", "gamma"]);
    });

    test("ignores subdirectories missing PKGBUILD", () => {
        seedPkgDir(tmp, "no-pkgbuild", {
            "lilac.yaml": "build_prefix: extra-x86_64\n",
        });
        seedPkgDir(tmp, "good", {
            PKGBUILD: "pkgname=good\n",
            "lilac.yaml": "build_prefix: extra-x86_64\n",
        });

        expect(readLilacConfigs([tmp])).toEqual(["good"]);
    });

    test("ignores subdirectories missing lilac yaml/yml", () => {
        seedPkgDir(tmp, "no-lilac", {
            PKGBUILD: "pkgname=lonely\n",
        });
        seedPkgDir(tmp, "good", {
            PKGBUILD: "pkgname=good\n",
            "lilac.yml": "build_prefix: extra-x86_64\n",
        });

        expect(readLilacConfigs([tmp])).toEqual(["good"]);
    });

    test("accepts both lilac.yaml and lilac.yml", () => {
        seedPkgDir(tmp, "yaml-pkg", {
            PKGBUILD: "pkgname=yamlpkg\n",
            "lilac.yaml": "x: 1\n",
        });
        seedPkgDir(tmp, "yml-pkg", {
            PKGBUILD: "pkgname=ymlpkg\n",
            "lilac.yml": "x: 1\n",
        });

        expect(readLilacConfigs([tmp]).sort()).toEqual(["yamlpkg", "ymlpkg"]);
    });

    test("ignores plain files at the parent level", () => {
        fs.writeFileSync(path.join(tmp, "README.md"), "");
        seedPkgDir(tmp, "good", {
            PKGBUILD: "pkgname=good\n",
            "lilac.yaml": "x: 1\n",
        });

        expect(readLilacConfigs([tmp])).toEqual(["good"]);
    });

    test("merges results across multiple parent directories", () => {
        const tmp2 = createTempDir();
        try {
            seedPkgDir(tmp, "one", {
                PKGBUILD: "pkgname=one\n",
                "lilac.yaml": "x: 1\n",
            });
            seedPkgDir(tmp2, "two", {
                PKGBUILD: "pkgname=two\n",
                "lilac.yaml": "x: 1\n",
            });

            expect(readLilacConfigs([tmp, tmp2]).sort()).toEqual(["one", "two"]);
        } finally {
            fs.rmSync(tmp2, { recursive: true, force: true });
        }
    });

    test("warns and skips when PKGBUILD has no pkgname assignment", () => {
        seedPkgDir(tmp, "broken", {
            PKGBUILD: "pkgver=1.0\n",
            "lilac.yaml": "x: 1\n",
        });
        seedPkgDir(tmp, "good", {
            PKGBUILD: "pkgname=good\n",
            "lilac.yaml": "x: 1\n",
        });

        const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
        try {
            expect(readLilacConfigs([tmp])).toEqual(["good"]);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(String(warnSpy.mock.calls[0]?.[0] ?? "")).toContain("Could not find pkgname");
        } finally {
            warnSpy.mockRestore();
        }
    });
});
