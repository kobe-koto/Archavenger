import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkAndObtainDefaultOptions } from "../src/checkAndObtainDefaultOptions.ts";

const createTempDir = (): string =>
    fs.mkdtempSync(path.join(os.tmpdir(), "archavenger-options-"));

const setArgv = (args: string[]): void => {
    process.argv = [process.execPath, path.join(process.cwd(), "index.ts"), ...args];
};

const mockExit = () => spyOn(process, "exit").mockImplementation((code?: string | number | null | undefined): never => {
    throw new Error(`__exit_${code ?? "undefined"}__`);
});

describe("checkAndObtainDefaultOptions", () => {
    let tmp: string;
    let originalArgv: string[];
    let restoreConsole: () => void;

    beforeEach(() => {
        tmp = createTempDir();
        originalArgv = [...process.argv];
        const logSpy = spyOn(console, "log").mockImplementation(() => { });
        const errorSpy = spyOn(console, "error").mockImplementation(() => { });
        const warnSpy = spyOn(console, "warn").mockImplementation(() => { });
        restoreConsole = () => {
            logSpy.mockRestore();
            errorSpy.mockRestore();
            warnSpy.mockRestore();
        };
    });

    afterEach(() => {
        process.argv = originalArgv;
        restoreConsole();
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test("returns normalized options with defaults for optional booleans", () => {
        setArgv(["--repo-root", tmp, "--max-keep", "2"]);

        expect(checkAndObtainDefaultOptions()).toEqual({
            repoRoot: path.resolve(tmp),
            maxKeep: 2,
            force: false,
            removeOrphanFiles: false,
            removeNonExistingPackages: false,
            existingPackageNames: [],
        });
    });

    test("returns true for enabled boolean flags", () => {
        setArgv([
            "--repo-root", tmp,
            "--max-keep", "3",
            "--force",
            "--remove-orphan-files",
            "--remove-nonexisting-packages",
        ]);

        const options = checkAndObtainDefaultOptions();
        expect(options.force).toBe(true);
        expect(options.removeOrphanFiles).toBe(true);
        expect(options.removeNonExistingPackages).toBe(true);
    });

    test("exits when repo-root is missing", () => {
        setArgv(["--max-keep", "1"]);
        const exitSpy = mockExit();
        try {
            expect(() => checkAndObtainDefaultOptions()).toThrow("__exit_1__");
            expect(exitSpy).toHaveBeenCalledWith(1);
        } finally {
            exitSpy.mockRestore();
        }
    });

    test("exits when repo-root does not exist", () => {
        setArgv(["--repo-root", path.join(tmp, "missing"), "--max-keep", "1"]);
        const exitSpy = mockExit();
        try {
            expect(() => checkAndObtainDefaultOptions()).toThrow("__exit_1__");
            expect(exitSpy).toHaveBeenCalledWith(1);
        } finally {
            exitSpy.mockRestore();
        }
    });

    test("exits when repo-root is a file", () => {
        const repoRootFile = path.join(tmp, "repo-file");
        fs.writeFileSync(repoRootFile, "not a directory");
        setArgv(["--repo-root", repoRootFile, "--max-keep", "1"]);

        const exitSpy = mockExit();
        try {
            expect(() => checkAndObtainDefaultOptions()).toThrow("__exit_1__");
            expect(exitSpy).toHaveBeenCalledWith(1);
        } finally {
            exitSpy.mockRestore();
        }
    });

    test("exits when max-keep is missing or negative", () => {
        for (const args of [
            ["--repo-root", tmp],
            ["--repo-root", tmp, "--max-keep", "-1"],
        ]) {
            setArgv(args);
            const exitSpy = mockExit();
            try {
                expect(() => checkAndObtainDefaultOptions()).toThrow("__exit_1__");
                expect(exitSpy).toHaveBeenCalledWith(1);
            } finally {
                exitSpy.mockRestore();
            }
        }
    });

    test("exits for max-keep zero unless the safety check is skipped", () => {
        setArgv(["--repo-root", tmp, "--max-keep", "0"]);
        const exitSpy = mockExit();
        try {
            expect(() => checkAndObtainDefaultOptions()).toThrow("__exit_1__");
            expect(exitSpy).toHaveBeenCalledWith(1);
        } finally {
            exitSpy.mockRestore();
        }

        setArgv(["--repo-root", tmp, "--max-keep", "0", "--skip-max-keep-zero-check"]);
        expect(checkAndObtainDefaultOptions().maxKeep).toBe(0);
    });

    test("prints help and exits successfully", () => {
        setArgv(["--help"]);
        const exitSpy = mockExit();
        try {
            expect(() => checkAndObtainDefaultOptions()).toThrow("__exit_0__");
            expect(exitSpy).toHaveBeenCalledWith(0);
        } finally {
            exitSpy.mockRestore();
        }
    });

    test("deduplicates package names from PreAUR and lilac configs", () => {
        const preaurConfig = path.join(tmp, "preaur.yaml");
        fs.writeFileSync(preaurConfig, [
            "packages:",
            "  - pkgname: alpha",
            "  - pkgname: shared",
            "",
        ].join("\n"));

        const lilacParent = path.join(tmp, "lilac");
        const sharedDir = path.join(lilacParent, "shared");
        const betaDir = path.join(lilacParent, "beta");
        fs.mkdirSync(sharedDir, { recursive: true });
        fs.mkdirSync(betaDir, { recursive: true });
        fs.writeFileSync(path.join(sharedDir, "PKGBUILD"), "pkgname=shared\n");
        fs.writeFileSync(path.join(sharedDir, "lilac.yaml"), "x: 1\n");
        fs.writeFileSync(path.join(betaDir, "PKGBUILD"), "pkgname=beta\n");
        fs.writeFileSync(path.join(betaDir, "lilac.yml"), "x: 1\n");

        setArgv([
            "--repo-root", tmp,
            "--max-keep", "1",
            "--preaur-config", preaurConfig,
            "--lilac-config", lilacParent,
        ]);

        expect(checkAndObtainDefaultOptions().existingPackageNames.sort()).toEqual(["alpha", "beta", "shared"]);
    });
});
