#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, MAX_KEEP } from "./config.ts"
import type { PackageInfo, Packages } from "./types.ts";
import pc from "picocolors";

// obtain args 
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
if (dryRun) {
    console.log(pc.bold(
        `${pc.yellow("==>")} Dry running...`
    ))
}

// read all arch's folders
const RepoArchFolders = fs.readdirSync(REPO_ROOT, { withFileTypes: true })
          .filter(item => item.isDirectory()).map(i=>i.name)

// read all folders contents
for (const arch of RepoArchFolders) {
    console.log(pc.bold(
        `${pc.green("==>")} Processing arch ${pc.blue(arch)}...`
    ))
    const PackageFiles = fs.readdirSync(path.join(REPO_ROOT, arch), { withFileTypes: true })
    .filter(item => item.name.includes(".pkg"))  // ignore all non pkg files
    .map(i=>i.name)
    
    // extract the package names
    const Packages: Packages = {};
    for (const pkg of PackageFiles) {
        if (pkg.endsWith(".sig")) { continue; }
        const slices = pkg.split(".pkg.tar")[0]!.split("-");
        const PackageInfo: PackageInfo = {
            arch: slices.pop()!,
            pkgrel: slices.pop()!,
            pkgver: slices.pop()!,
            modifiedTime: fs.statSync(path.join(REPO_ROOT, arch, pkg)).mtimeMs
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
        Packages[pkgname]!.sort((a, b) => b.modifiedTime - a.modifiedTime);
        // slice off the max keep pkgs
        Packages[pkgname] = Packages[pkgname]!.slice(MAX_KEEP);
        // delete
        if (Packages[pkgname]!.length === 0) {
            console.log(pc.gray("     No old pkgs to delete, skipping..."));
            continue;
        } else { // generate the list of old pkgs to delete
            const list = [];
            for (const pkg of Packages[pkgname]!) {
                const pkgFilenameStart = `${pkgname}-${pkg.pkgver}-${pkg.pkgrel}-${pkg.arch}.pkg`;
                list.push(...PackageFiles.filter(i => i.startsWith(pkgFilenameStart)));
            }
            for (const file of list) {
                const filepath = path.join(REPO_ROOT, arch, file);
                if (!dryRun) {
                    console.log(`     Deleting ${filepath}...`);
                    fs.unlinkSync(filepath);
                } else {
                    console.log(pc.gray(`     Skipping delete ${filepath}...`));
                }
            }
        }
    }
}