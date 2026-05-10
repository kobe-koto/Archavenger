import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RepoOperator, findRepoDBPath, readRepoSubdirs } from "../src/repoOperator.ts";

const createTempDir = (): string =>
    fs.mkdtempSync(path.join(os.tmpdir(), "archavenger-repoop-"));

const writeFile = (filePath: string, content: string = ""): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
};

const seedRepoDB = (dir: string, name: string = "kpreaur"): void => {
    writeFile(path.join(dir, `${name}.db`), "");
    writeFile(path.join(dir, `${name}.db.tar.gz`), "");
};

describe("readRepoSubdirs", () => {
    let tmp: string;

    beforeEach(() => {
        tmp = createTempDir();
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test("returns the list of subdirectories when present", () => {
        fs.mkdirSync(path.join(tmp, "x86_64"));
        fs.mkdirSync(path.join(tmp, "aarch64"));
        writeFile(path.join(tmp, "stray-file"), "ignored");

        const result = readRepoSubdirs(tmp).sort();
        expect(result).toEqual(["aarch64", "x86_64"]);
    });

    test("falls back to a single empty-string entry when no subdirs exist", () => {
        writeFile(path.join(tmp, "kpreaur.db"));
        expect(readRepoSubdirs(tmp)).toEqual([""]);
    });
});

describe("findRepoDBPath", () => {
    let tmp: string;
    let restoreConsole: () => void;

    beforeEach(() => {
        tmp = createTempDir();
        const logSpy = spyOn(console, "log").mockImplementation(() => { });
        const errorSpy = spyOn(console, "error").mockImplementation(() => { });
        restoreConsole = () => {
            logSpy.mockRestore();
            errorSpy.mockRestore();
        };
    });

    afterEach(() => {
        restoreConsole();
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test("returns the archive path for a well-formed repo (happy path)", () => {
        seedRepoDB(tmp, "kpreaur");
        const result = findRepoDBPath(tmp, "");
        expect(result).toBe(path.join(tmp, "kpreaur.db.tar.gz"));
    });

    test("ignores .old files and pkginfo.db files when locating the db", () => {
        writeFile(path.join(tmp, "pkginfo.db"));
        writeFile(path.join(tmp, "kpreaur.db.old"));
        writeFile(path.join(tmp, "kpreaur.db"));
        writeFile(path.join(tmp, "kpreaur.db.tar.zst"));
        expect(findRepoDBPath(tmp, "")).toBe(path.join(tmp, "kpreaur.db.tar.zst"));
    });

    test("exits when no .db file exists in the directory", () => {
        const exitSpy = spyOn(process, "exit").mockImplementation(((_code?: number) => {
            throw new Error("__exit__");
        }) as typeof process.exit);
        try {
            expect(() => findRepoDBPath(tmp, "")).toThrow("__exit__");
            expect(exitSpy).toHaveBeenCalledWith(1);
        } finally {
            exitSpy.mockRestore();
        }
    });

    test("exits when multiple archive files exist for the same .db", () => {
        writeFile(path.join(tmp, "kpreaur.db"));
        writeFile(path.join(tmp, "kpreaur.db.tar.gz"));
        writeFile(path.join(tmp, "kpreaur.db.tar.zst"));
        const exitSpy = spyOn(process, "exit").mockImplementation(((_code?: number) => {
            throw new Error("__exit__");
        }) as typeof process.exit);
        try {
            expect(() => findRepoDBPath(tmp, "")).toThrow("__exit__");
            expect(exitSpy).toHaveBeenCalledWith(1);
        } finally {
            exitSpy.mockRestore();
        }
    });

    test("exits when no archive file accompanies the .db", () => {
        writeFile(path.join(tmp, "kpreaur.db"));
        const exitSpy = spyOn(process, "exit").mockImplementation(((_code?: number) => {
            throw new Error("__exit__");
        }) as typeof process.exit);
        try {
            expect(() => findRepoDBPath(tmp, "")).toThrow("__exit__");
            expect(exitSpy).toHaveBeenCalledWith(1);
        } finally {
            exitSpy.mockRestore();
        }
    });
});

describe("RepoOperator.parsePackages", () => {
    let tmp: string;
    let restoreConsole: () => void;

    beforeEach(() => {
        tmp = createTempDir();
        seedRepoDB(tmp);
        const logSpy = spyOn(console, "log").mockImplementation(() => { });
        restoreConsole = () => {
            logSpy.mockRestore();
        };
    });

    afterEach(() => {
        restoreConsole();
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test("groups package files by pkgname and sorts versions newest-first", () => {
        const files = [
            "foo-1.0-1-x86_64.pkg.tar.zst",
            "foo-1.2-1-x86_64.pkg.tar.zst",
            "foo-1.10-1-x86_64.pkg.tar.zst",
            "bar-2.0-1-x86_64.pkg.tar.zst",
        ];
        for (const f of files) writeFile(path.join(tmp, f));

        const op = new RepoOperator(tmp, "", false);
        const { Packages, orphanFiles } = op.parsePackages([...files]);

        expect(Object.keys(Packages).sort()).toEqual(["bar", "foo"]);
        expect(Packages["foo"]?.map(p => p.pkgver)).toEqual(["1.10", "1.2", "1.0"]);
        expect(Packages["bar"]?.map(p => p.pkgver)).toEqual(["2.0"]);
        expect(orphanFiles).toEqual([]);
    });

    test("attaches signatures and debug-symbol packages to the parent package files", () => {
        const files = [
            "foo-1.0-1-x86_64.pkg.tar.zst",
            "foo-1.0-1-x86_64.pkg.tar.zst.sig",
            "foo-debug-1.0-1-x86_64.pkg.tar.zst",
            "foo-debug-1.0-1-x86_64.pkg.tar.zst.sig",
        ];
        for (const f of files) writeFile(path.join(tmp, f));

        const op = new RepoOperator(tmp, "", false);
        const { Packages, orphanFiles } = op.parsePackages([...files]);

        expect(Object.keys(Packages)).toEqual(["foo"]);
        const foo = Packages["foo"];
        expect(foo).toBeDefined();
        expect(foo?.length).toBe(1);
        expect(foo?.[0]?.hasDebugSymbols).toBe(true);
        expect(foo?.[0]?.files.sort()).toEqual([...files].sort());
        expect(orphanFiles).toEqual([]);
    });

    test("excludes -debug as a top-level package and never creates a -debug entry", () => {
        const files = [
            "foo-1.0-1-x86_64.pkg.tar.zst",
            "foo-debug-1.0-1-x86_64.pkg.tar.zst",
        ];
        for (const f of files) writeFile(path.join(tmp, f));

        const op = new RepoOperator(tmp, "", false);
        const { Packages } = op.parsePackages([...files]);

        expect(Object.keys(Packages)).toEqual(["foo"]);
        expect(Packages["foo-debug"]).toBeUndefined();
    });

    test("handles epoch in version strings", () => {
        const files = [
            "foo-1.0-1-x86_64.pkg.tar.zst",
            "foo-1:1.0-1-x86_64.pkg.tar.zst",
        ];
        for (const f of files) writeFile(path.join(tmp, f));

        const op = new RepoOperator(tmp, "", false);
        const { Packages } = op.parsePackages([...files]);

        const foo = Packages["foo"];
        expect(foo?.length).toBe(2);
        expect(foo?.[0]?.epoch).toBe(1);
        expect(foo?.[1]?.epoch).toBe(0);
    });

    test("returns leftover unmatched files as orphan files", () => {
        const files = [
            "foo-1.0-1-x86_64.pkg.tar.zst",
            "stale-foo-1.0-1-x86_64.pkg.tar.zst.sig",
        ];
        for (const f of files) writeFile(path.join(tmp, f));

        const op = new RepoOperator(tmp, "", false);
        const { orphanFiles } = op.parsePackages([...files]);

        expect(orphanFiles).toContain("stale-foo-1.0-1-x86_64.pkg.tar.zst.sig");
    });
});

describe("RepoOperator.deleteFile", () => {
    let tmp: string;
    let restoreConsole: () => void;

    beforeEach(() => {
        tmp = createTempDir();
        seedRepoDB(tmp);
        const logSpy = spyOn(console, "log").mockImplementation(() => { });
        restoreConsole = () => {
            logSpy.mockRestore();
        };
    });

    afterEach(() => {
        restoreConsole();
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test("dry-run mode skips deletion and leaves the file intact", () => {
        const target = "foo-1.0-1-x86_64.pkg.tar.zst";
        writeFile(path.join(tmp, target));

        const op = new RepoOperator(tmp, "", false);
        const result = op.deleteFile(target);

        expect(result.status).toBe("skipped");
        expect(fs.existsSync(path.join(tmp, target))).toBe(true);
    });

    test("force mode actually deletes the file and returns success", () => {
        const target = "foo-1.0-1-x86_64.pkg.tar.zst";
        writeFile(path.join(tmp, target));

        const op = new RepoOperator(tmp, "", true);
        const result = op.deleteFile(target);

        expect(result.status).toBe("success");
        expect(fs.existsSync(path.join(tmp, target))).toBe(false);
    });

    test("force mode returns an error result when the file does not exist", () => {
        const op = new RepoOperator(tmp, "", true);
        const result = op.deleteFile("missing.pkg.tar.zst");

        expect(result.status).toBe("error");
        expect(result.details).toBeDefined();
    });
});
