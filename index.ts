#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import type { PackageInfo, Packages } from "./src/types.ts";
import { packageSorter } from "./src/packageSorter.ts";
import { checkAndObtainDefaultOptions } from "./src/checkAndObtainDefaultOptions.ts";

const options = checkAndObtainDefaultOptions();

if (!options.force) {
    console.log(pc.bold(
        `${pc.yellow("==>")} Dry running (add --force to actually delete)...`
    ))
}

// read all arch's folders
const RepoArchFolders = fs.readdirSync(options.repoRoot, { withFileTypes: true })
    .filter(item => item.isDirectory()).map(i => i.name)
if (RepoArchFolders.length === 0) {
    RepoArchFolders.push(""); // default to root if no arch folders found
}

// read all folders contents
for (const arch of RepoArchFolders) {
    if (!!arch) {
        console.log(pc.bold(
            `${pc.green("==>")} Processing arch ${pc.blue(arch)}...`
        ))
    } else {
        console.log(pc.bold(
            `${pc.green("==>")} Processing root repo directory...`
        ))
    }
    const PackageFiles = fs.readdirSync(path.join(options.repoRoot, arch), { withFileTypes: true })
        .filter(item => item.name.includes(".pkg"))  // ignore all non pkg files
        .map(i => i.name)

    // extract the package names
    const Packages: Packages = {};
    for (const pkg of PackageFiles) {
        if (pkg.endsWith(".sig")) { continue; }
        const slices = pkg.split(".pkg.tar")[0]!.split("-");

        const __arch = slices.pop()!,
              __pkgrel = slices.pop()!;
        const __EpochAndPkgverSlices = slices.pop()!.split(":");
        const __pkgver = __EpochAndPkgverSlices.pop()!,
              __epoch = parseInt(__EpochAndPkgverSlices.shift() || "0"); // handle epoch if exists

        const PackageInfo: PackageInfo = {
            arch: __arch,
            pkgrel: __pkgrel,
            pkgver: __pkgver,
            epoch: __epoch,
            modifiedTime: fs.statSync(path.join(options.repoRoot, arch, pkg), { bigint: true }).mtimeMs
        }
        const pkgname = slices.join("-");
        if (!Packages[pkgname]) { Packages[pkgname] = [] } // non empty check
        Packages[pkgname].push(PackageInfo)
    }
    for (const pkgname in Packages) {
        console.log(pc.bold(
            `${pc.blue("  ->")} Proceeding with ${pc.blue(pkgname)}...`
        ))
        // sort pkgs from new to old
        Packages[pkgname]!.sort(packageSorter);
        Packages[pkgname]!.reverse();
        if (options.existingPackageNames.includes(pkgname) || options.existingPackageNames.length === 0) {
            // slice off the max keep pkgs
            Packages[pkgname] = Packages[pkgname]!.slice(options.maxKeep);
        } else {
            console.log(pc.yellow(`     Package ${pkgname} is no longer in builder configs, removing all leftover pkgs...`));
            Packages[pkgname] = Packages[pkgname]!;
        }
        // delete
        if (Packages[pkgname]!.length === 0) {
            console.log(pc.gray("     No old pkgs to delete, skipping..."));
            continue;
        } else { // generate the list of old pkgs to delete
            const list = [];
            for (const pkg of Packages[pkgname]!) {
                let pkgFilenameHead = `${pkgname}-`;
                if (pkg.epoch > 0) {
                    pkgFilenameHead += `${pkg.epoch}:`;
                }
                pkgFilenameHead += `${pkg.pkgver}-${pkg.pkgrel}-${pkg.arch}.pkg`;
                list.push(...PackageFiles.filter(i => i.startsWith(pkgFilenameHead)));
            }
            console.log(pc.yellow(`     Found ${list.length} old pkgs to delete:`));
            for (const file of list) {
                const filepath = path.join(options.repoRoot, arch, file);
                if (options.force) {
                    console.log(`     Deleting ${filepath}...`);
                    fs.unlinkSync(filepath);
                } else {
                    console.log(pc.gray(`     Skipping delete ${filepath}...`));
                }
            }
        }
    }
}
