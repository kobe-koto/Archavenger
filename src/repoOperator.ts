import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { packageSorter } from "./packageSorter.ts";
import type { PackageInfo, Packages } from "./types.ts";

export function readRepoSubdirs(repoRoot: string): string[] {
    const RepoArchFolders = fs.readdirSync(repoRoot, { withFileTypes: true })
        .filter(item => item.isDirectory()).map(i => i.name)
    if (RepoArchFolders.length === 0) {
        return [""]; // default to root if no arch folders found
    } else {
        return RepoArchFolders;
    }
}

export function readPackageFiles(repoRoot: string, subdir: string): string[] {
    return fs.readdirSync(path.join(repoRoot, subdir), { withFileTypes: true })
        .filter(item => item.name.includes(".pkg"))  // ignore all non pkg files
        .map(i => i.name)
}

export function parsePackages(subdirPackageFiles: string[], repoRoot: string, subdir: string) {
    const Packages: Packages = {};
    for (const pkg of subdirPackageFiles) {
        if (pkg.endsWith(".sig")) { continue }; // ignore signature files
        const slices = pkg.split(".pkg.tar")[0]!.split("-");

        const __arch = slices.pop()!,
              __pkgrel = slices.pop()!;
        const __EpochAndPkgverSlices = slices.pop()!.split(":");
        const __pkgver = __EpochAndPkgverSlices.pop()!,
              __epoch = parseInt(__EpochAndPkgverSlices.shift() || "0"); // handle epoch if exists
        const pkgname = slices.join("-");

        if (pkgname.endsWith("-debug")) { continue }; // ignore debug symbol packages

        let pkgFilePattern = "";
        if (__epoch > 0) {
            pkgFilePattern += `${__epoch}:`;
        }
        pkgFilePattern += `${__pkgver}-${__pkgrel}-${__arch}.pkg`;
        

        const packageFiles = subdirPackageFiles.filter(
            i => i.startsWith(pkgname + "-" + pkgFilePattern)
        );
        const packageDebugSymbolFiles = subdirPackageFiles.filter(
            i => i.startsWith(pkgname + "-debug-" + pkgFilePattern)
        );

        const PackageInfo: PackageInfo = {
            arch: __arch,
            pkgrel: __pkgrel,
            pkgver: __pkgver,
            epoch: __epoch,
            modifiedTime: fs.statSync(path.join(repoRoot, subdir, pkg), { bigint: true }).mtimeMs,
            files: [ ...packageFiles, ...packageDebugSymbolFiles ],
            hasDebugSymbols: packageDebugSymbolFiles.length > 0
        }
        // console.log(PackageInfo);
        if (!Packages[pkgname]) { Packages[pkgname] = [] } // non empty check
        Packages[pkgname].push(PackageInfo)
    }
    
    // sort pkgs from new to old
    for (const pkgname in Packages) {
        Packages[pkgname]!.sort(packageSorter);
        Packages[pkgname]!.reverse();
    }
    return Packages;
}

export function removeFromRepoDb(repoDbPath: string, pkgname: string) {
    // repo-remove [options] <path-to-db> <packagename> 
    const repoRemoveCmd = `repo-remove "${repoDbPath}" "${pkgname}"`;
    const repoRemoveProcess = spawnSync(repoRemoveCmd, { shell: true, env: { ...process.env, LANG: "C" } });
    if (repoRemoveProcess.status !== 0) {
        throw new Error(`repo-remove command failed for package ${pkgname} with exit code ${repoRemoveProcess.status}. \nCommand: ${repoRemoveCmd}, output: ${repoRemoveProcess.output.toString()}`);
    }
    return repoRemoveProcess;
}