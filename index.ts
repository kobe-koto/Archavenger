#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import type { PackageInfo, Packages } from "./types.ts";
import pc from "picocolors";

// obtain args 
const args = process.argv.slice(2);


function printHelp() {
    console.log(`
Usage: bun run index.ts --repo-root <path> --max-keep <number> [--force]

Options:
  --repo-root <path>    The root directory of the arch package repository (required)
  --max-keep <number>   The maximum number of package versions to keep (required)
  --force               Actually delete the old packages (default is dry-run)
  --help, -h            Show this help message
    `.trim());
    process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
    printHelp();
}

const force = args.includes('--force');

const repoRootIndex = args.indexOf('--repo-root');
const REPO_ROOT = (repoRootIndex !== -1 ? path.resolve(args[repoRootIndex + 1]!) : "") as string;
if (!REPO_ROOT) {
    console.error(pc.red("Error: --repo-root <path> is required."));
    printHelp();
    process.exit(1);
} else if (!fs.existsSync(REPO_ROOT) || !fs.statSync(REPO_ROOT).isDirectory()) {
    console.error(pc.red(`Error: The specified --repo-root path "${REPO_ROOT}" does not exist or is not a directory.`));
    printHelp();
    process.exit(1);
}

const maxKeepIndex = args.indexOf('--max-keep');
const MAX_KEEP = (maxKeepIndex !== -1 ? parseInt(args[maxKeepIndex + 1]!, 10) : -1) as number;
if (isNaN(MAX_KEEP) || MAX_KEEP < 0) {
    console.error(pc.red("Error: --max-keep <number> is required and must be a positive integer."));
    printHelp();
    process.exit(1);
}

if (!force) {
    console.log(pc.bold(
        `${pc.yellow("==>")} Dry running (add --force to actually delete)...`
    ))
}

// read all arch's folders
let RepoArchFolders = fs.readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter(item => item.isDirectory()).map(i => i.name)
if (RepoArchFolders.length === 0) {
    RepoArchFolders = [""]; // default to root if no arch folders found
}

// read all folders contents
for (const arch of RepoArchFolders) {
    console.log(pc.bold(
        `${pc.green("==>")} Processing arch ${pc.blue(arch)}...`
    ))
    const PackageFiles = fs.readdirSync(path.join(REPO_ROOT, arch), { withFileTypes: true })
        .filter(item => item.name.includes(".pkg"))  // ignore all non pkg files
        .map(i => i.name)

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
                if (force) {
                    console.log(`     Deleting ${filepath}...`);
                    fs.unlinkSync(filepath);
                } else {
                    console.log(pc.gray(`     Skipping delete ${filepath}...`));
                }
            }
        }
    }
}