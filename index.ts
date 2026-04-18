#!/usr/bin/env bun
import path from "node:path";
import pc from "picocolors";
import { checkAndObtainDefaultOptions } from "./src/checkAndObtainDefaultOptions.ts";
import { readRepoSubdirs, RepoOperator } from "./src/repoOperator.ts";

const options = checkAndObtainDefaultOptions();

if (!options.force) {
    console.log(pc.bold(
        `${pc.yellow("==>")} Dry running (add --force to actually delete)...`
    ))
}

// read all arch's folders
const RepoSubdirs = readRepoSubdirs(options.repoRoot);

// read all folders contents
for (const subdir of RepoSubdirs) {
    const RepoOperatorInstance = new RepoOperator(options.repoDbPath, options.repoRoot, subdir, options.force);
    const { readPackageFiles, parsePackages, removeFromRepoDb, deleteFile } = RepoOperatorInstance;

    if (!!subdir) {
        console.log(pc.bold(
            `${pc.green("==>")} Processing subdir ${pc.blue(subdir)}...`
        ))
    } else {
        console.log(pc.bold(
            `${pc.green("==>")} Processing root repo directory...`
        ))
    }

    // extract the package names
    const PackageFiles = readPackageFiles();
    const { orphanFiles, Packages } = parsePackages(PackageFiles);
    if (options.removeOrphanFiles && orphanFiles.length > 0) {
        console.log(pc.yellow(`     Found ${orphanFiles.length} orphan files that don't match any package, deleting...`));
        for (const filename of orphanFiles) {
            const result = deleteFile(filename);
            console.log(`       ${result.message}`);
            result.details && console.log(`       Details: ${result.details}`);
        }
    }
    for (const pkgname in Packages) {
        console.log(pc.bold(
            `${pc.blue("  ->")} Proceeding with ${pc.blue(pkgname)}...`
        ))


        // how many?
        let needRemoveFromRepoDb = false;
        if (options.maxKeep === 0) {
            console.log(pc.yellow(`     --max-keep is set to 0, removing from repo db and deleting all packages...`));
            needRemoveFromRepoDb = true;
        } else if (options.existingPackageNames.length > 0 && !options.existingPackageNames.includes(pkgname)) {
            console.log(pc.yellow(`     Package ${pkgname} is no longer in builder configs, removing from repo db and deleting all packages...`));
            needRemoveFromRepoDb = true;
        } else {
            // slice off the max keep pkgs
            Packages[pkgname] = Packages[pkgname]!.slice(options.maxKeep);
        }

        // remove from repo db?
        if (needRemoveFromRepoDb) {
            const removalResult = removeFromRepoDb(pkgname);
            console.log(`     ${removalResult.message}`);
            removalResult.details && console.log(`     Details: ${removalResult.details}`);
            if (Packages[pkgname]!.some(pkg => pkg.hasDebugSymbols)) {
                const debugPkgname = pkgname + "-debug";
                const debugSymbolRemovalResult = removeFromRepoDb(debugPkgname);
                console.log(`     ${debugSymbolRemovalResult.message}`);
                debugSymbolRemovalResult.details && console.log(`     Details: ${debugSymbolRemovalResult.details}`);
            }
        }

        // delete?
        if (Packages[pkgname]!.length === 0) {
            console.log(pc.gray("     No old pkgs to delete, skipping..."));
            continue;
        } else {
            for (const pkgInfo of Packages[pkgname]!) {
                for (const filename of pkgInfo.files) {
                    const result = deleteFile(filename);
                    console.log(`     ${result.message}`);
                    result.details && console.log(`     Details: ${result.details}`);
                }
            }
        }
    }
}
