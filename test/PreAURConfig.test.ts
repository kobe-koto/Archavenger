import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readPreAURConfigs } from "../src/utils/PreAURConfig.ts";

const createTempDir = (): string =>
    fs.mkdtempSync(path.join(os.tmpdir(), "archavenger-preaur-"));

describe("readPreAURConfigs", () => {
    let tmp: string;

    beforeEach(() => {
        tmp = createTempDir();
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test("returns pkgnames from a valid YAML config", () => {
        const cfg = path.join(tmp, "preaur.yaml");
        fs.writeFileSync(cfg, [
            "packages:",
            "  - pkgname: foo",
            "  - pkgname: bar",
            "  - pkgname: baz",
            "",
        ].join("\n"));

        expect(readPreAURConfigs([cfg])).toEqual(["foo", "bar", "baz"]);
    });

    test("merges pkgnames across multiple config files", () => {
        const a = path.join(tmp, "a.yaml");
        const b = path.join(tmp, "b.yaml");
        fs.writeFileSync(a, "packages:\n  - pkgname: alpha\n");
        fs.writeFileSync(b, "packages:\n  - pkgname: beta\n  - pkgname: gamma\n");

        expect(readPreAURConfigs([a, b])).toEqual(["alpha", "beta", "gamma"]);
    });

    test("warns and returns no names when 'packages' key is missing", () => {
        const cfg = path.join(tmp, "no-packages.yaml");
        fs.writeFileSync(cfg, "other: value\n");

        const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
        try {
            const names = readPreAURConfigs([cfg]);
            expect(names).toEqual([]);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const arg = warnSpy.mock.calls[0]?.[0];
            expect(typeof arg).toBe("string");
            expect(String(arg)).toContain("does not contain a \"packages\" array");
        } finally {
            warnSpy.mockRestore();
        }
    });

    test("warns when 'packages' is present but not an array", () => {
        const cfg = path.join(tmp, "scalar-packages.yaml");
        fs.writeFileSync(cfg, "packages: notAnArray\n");

        const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
        try {
            expect(readPreAURConfigs([cfg])).toEqual([]);
            expect(warnSpy).toHaveBeenCalledTimes(1);
        } finally {
            warnSpy.mockRestore();
        }
    });

    test("exits with an error log when a config file cannot be read", () => {
        const missing = path.join(tmp, "does-not-exist.yaml");

        const errorSpy = spyOn(console, "error").mockImplementation(() => {});
        const exitSpy = spyOn(process, "exit").mockImplementation(((_code?: number) => {
            throw new Error("__exit__");
        }) as typeof process.exit);
        try {
            expect(() => readPreAURConfigs([missing])).toThrow("__exit__");
            expect(exitSpy).toHaveBeenCalledWith(1);
            expect(errorSpy).toHaveBeenCalled();
        } finally {
            exitSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});
