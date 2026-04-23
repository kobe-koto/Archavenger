#!/usr/bin/env bun
import pc from "picocolors";
import { TreeLogger } from "./src/TreeLogger.ts";
import { checkAndObtainDefaultOptions } from "./src/checkAndObtainDefaultOptions.ts";
import { readRepoSubdirs, RepoOperator } from "./src/repoOperator.ts";

const mainTreeLogger = new TreeLogger(0);
const subdirLogger = mainTreeLogger.createChildLogger(2);
const packageProcessingLogger = subdirLogger.createChildLogger(3);

const options = checkAndObtainDefaultOptions();

if (!options.force) {
    mainTreeLogger.log(pc.bold(
        `${pc.yellow("==>")} Dry running (add --force to actually delete)...`
    ))
}


// read all arch's folders
const RepoSubdirs = readRepoSubdirs(options.repoRoot);
for (const subdir of RepoSubdirs) {
    if (!!subdir) {
        mainTreeLogger.log(pc.bold(
            `${pc.green("==>")} Processing subdir ${pc.blue(subdir)}...`
        ))
    } else {
        mainTreeLogger.log(pc.bold(
            `${pc.green("==>")} Processing root repo directory...`
        ))
    }

    const RepoOperatorInstance = new RepoOperator(options.repoRoot, subdir, options.force);
    const { readPackageFiles, parsePackages, removeFromRepoDb, deleteFile } = RepoOperatorInstance;



    // extract the package names
    const PackageFiles = readPackageFiles();
    const { orphanFiles, Packages } = parsePackages(PackageFiles);

    // remove orphan files
    if (options.removeOrphanFiles && orphanFiles.length > 0) {
        subdirLogger.log(pc.bold(pc.yellow(`${pc.blue("->")} Deleting ${orphanFiles.length} orphan files...`)));
        for (const filename of orphanFiles) {
            const result = deleteFile(filename);
            packageProcessingLogger.log(result.message);
            result.details && packageProcessingLogger.log(`Details: ${result.details}`);
        }
    }

    // gc old pkgs and remove from db if needed
    //  - record all pkgnames that should be preserved in db
    let pkgnames = new Set<string>();
    for (const pkgname in Packages) {
        subdirLogger.log(pc.bold(
            `${pc.blue("->")} Proceeding with ${pc.blue(pkgname)}...`
        ))

        // how many?
        let needRemoveFromRepoDb = false;
        if (options.maxKeep === 0) {
            packageProcessingLogger.log(pc.yellow(`--max-keep is set to 0, removing from repo db and deleting all packages...`));
            needRemoveFromRepoDb = true;
        } else if (options.existingPackageNames.length > 0 && !options.existingPackageNames.includes(pkgname)) {
            packageProcessingLogger.log(pc.yellow(`Package ${pkgname} is no longer in builder configs, removing from repo db and deleting all packages...`));
            needRemoveFromRepoDb = true;
        } else {
            // slice off the max keep pkgs
            Packages[pkgname] = Packages[pkgname]!.slice(options.maxKeep);
        }

        // remove from repo db?
        if (needRemoveFromRepoDb) {
            const removalResult = removeFromRepoDb(pkgname);
            packageProcessingLogger.log(removalResult.message);
            removalResult.details && packageProcessingLogger.log(`Details: ${removalResult.details}`);
            if (Packages[pkgname]!.some(pkg => pkg.hasDebugSymbols)) {
                const debugPkgname = pkgname + "-debug";
                const debugSymbolRemovalResult = removeFromRepoDb(debugPkgname);
                packageProcessingLogger.log(debugSymbolRemovalResult.message);
                debugSymbolRemovalResult.details && packageProcessingLogger.log(`Details: ${debugSymbolRemovalResult.details}`);
            }
        } else {
            pkgnames.add(pkgname);
        }

        // delete?
        if (Packages[pkgname]!.length === 0) {
            packageProcessingLogger.log(pc.gray("No old pkgs to delete, skipping..."));
            continue;
        } else {
            for (const pkgInfo of Packages[pkgname]!) {
                for (const filename of pkgInfo.files) {
                    const result = deleteFile(filename);
                    packageProcessingLogger.log(result.message);
                    result.details && packageProcessingLogger.log(`Details: ${result.details}`);
                }
            }
        }
    }

    // remove non existing packages from rpeo db
    if (options.removeNonExistingPackages) {
        // read all packages from the repo db
        const allPackages = await RepoOperatorInstance.readPackagesFromRepoDB();
        const pkgnamesInDB = new Set(Object.keys(allPackages));
        const pkgnamesDiff = pkgnamesInDB.difference(pkgnames);
        if (pkgnamesDiff.size > 0) {
            subdirLogger.log(pc.bold(pc.yellow(`${pc.blue("->")} Removing ${pkgnamesDiff.size} non existing packages from rpeo...`)));
        }
        for (let pkgname of pkgnamesDiff) {
            const removalResult = RepoOperatorInstance.removeFromRepoDb(pkgname);
            packageProcessingLogger.log(removalResult.message);
            removalResult.details && packageProcessingLogger.log(`Details: ${removalResult.details}`);
            if (allPackages[pkgname]!.some(pkg => pkg.hasDebugSymbols)) {
                const debugPkgname = pkgname + "-debug";
                const debugSymbolRemovalResult = RepoOperatorInstance.removeFromRepoDb(debugPkgname);
                packageProcessingLogger.log(debugSymbolRemovalResult.message);
                debugSymbolRemovalResult.details && packageProcessingLogger.log(`Details: ${debugSymbolRemovalResult.details}`);
            }
        }
    }
}
