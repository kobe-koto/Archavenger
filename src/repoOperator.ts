import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { spawnSync } from "node:child_process";
import { packageSorter } from "./packageSorter.ts";
import type { OperationResult, PackageInfo, Packages } from "./types.ts";

export class RepoOperator {
    repoDBPath: string;
    repoRoot: string;
    subdir: string;
    force: boolean;
    constructor(repoDBPath: string, repoRoot: string, subdir: string, force: boolean = false) {
        this.repoDBPath = repoDBPath;
        this.repoRoot = repoRoot;
        this.subdir = subdir;
        this.force = force;
    }
    readPackageFiles = (): string[] => {
        return fs.readdirSync(path.join(this.repoRoot, this.subdir), { withFileTypes: true })
            .filter(item => item.name.includes(".pkg"))  // ignore all non pkg files
            .map(i => i.name)
    }
    parsePackages = (subdirPackageFiles: string[]) => {
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
                modifiedTime: fs.statSync(path.join(this.repoRoot, this.subdir, pkg), { bigint: true }).mtimeMs,
                files: [ ...packageFiles, ...packageDebugSymbolFiles ],
                hasDebugSymbols: packageDebugSymbolFiles.length > 0
            }
            
            // remove matched files from the list to avoid duplicate processing
            const filesSet = new Set(PackageInfo.files);
            subdirPackageFiles = subdirPackageFiles.filter(file => !filesSet.has(file));

            if (!Packages[pkgname]) { Packages[pkgname] = [] } // non empty check

            Packages[pkgname].push(PackageInfo)
        }

        // sort pkgs from new to old
        for (const pkgname in Packages) {
            Packages[pkgname]!.sort(packageSorter);
            Packages[pkgname]!.reverse();
        }
        return {
            // remaining of subdirPackageFiles is isolated/orphan files, 
            // a -debug w/o a main, a .sig w/o a pkg to sign, etc
            orphanFiles: subdirPackageFiles,
            Packages,
        };
    }
    removeFromRepoDb = (pkgname: string): OperationResult => {
        // repo-remove [options] <path-to-db> <packagename> 
        if (this.force) {
            const repoRemoveCmd = `repo-remove "${this.repoDBPath}" "${pkgname}"`;
            const repoRemoveProcess = spawnSync(repoRemoveCmd, { shell: true, env: { ...process.env, LANG: "C" } });
            if (repoRemoveProcess.status !== 0) {
                return {
                    status: "error",
                    message: pc.red(`Failed to remove ${pkgname} from repo db.`),
                    details: `repo-remove command failed for package ${pkgname} with exit code ${repoRemoveProcess.status}. \n` + 
                             `Command: ${repoRemoveCmd}, output: \n${repoRemoveProcess.output.toString().replace(/(^,|,$)/g, "")}`
                             // repo-remove output contains a leading comma for some reason...?
                }
            } else {
                return {
                    status: "success",
                    message: pc.green(`Successfully removed ${pkgname} from repo db.`)
                }
            }
        } else {
            return {
                status: "skipped",
                message: pc.gray(`Skipped repo-remove for ${pkgname}...`)
            }
        }
    }
    deleteFile = (filename: string): OperationResult => {
        if (this.force) {
            try {
                fs.rmSync(path.join(this.repoRoot, this.subdir, filename));
                return {
                    status: "success",
                    message: pc.green(`Successfully deleted file ${filename}.`)
                }
            } catch (error) {
                return {
                    status: "error",
                    message: pc.red(`Failed to delete file ${filename}.`),
                    details: error instanceof Error ? error.message : String(error)
                }
            }
        } else {
            return {
                status: "skipped",
                message: pc.gray(`Skipped deletion of file ${filename}.`)
            }
        }
    }
}

export function readRepoSubdirs(repoRoot: string): string[] {
    const RepoArchFolders = fs.readdirSync(repoRoot, { withFileTypes: true })
        .filter(item => item.isDirectory()).map(i => i.name)
    if (RepoArchFolders.length === 0) {
        return [""]; // default to root if no arch folders found
    } else {
        return RepoArchFolders;
    }
}
