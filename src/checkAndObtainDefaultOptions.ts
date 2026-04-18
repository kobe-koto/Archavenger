import commandLineArgs from "command-line-args";
import { commandLineUsages } from "./commandLineUsages.ts";
import { optionDefinitions } from "./optionDefinitions.ts";

import { readPreAURConfigs } from "./utils/PreAURConfig.ts";
import { readLilacConfigs } from "./utils/LilacConfig.ts";

import pc from "picocolors";
import path from "node:path";
import fs from "node:fs";

export function checkAndObtainDefaultOptions () {
    let options;
    try {
        options = commandLineArgs(optionDefinitions);
    } catch (err) {
        console.error(pc.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        console.log("Use --help to see usage.");
        process.exit(1);
    }

    if (options.help) {
        console.log(commandLineUsages);
        process.exit(0);
    }

    const REPO_ROOT = (options["repo-root"] ? path.resolve(options["repo-root"]) : "") as string;
    if (!REPO_ROOT) {
        console.error(pc.red("Error: --repo-root <path> is required."));
        console.log("Use --help to see usage.");
        process.exit(1);
    } else if (!fs.existsSync(REPO_ROOT)) {
        console.error(pc.red(`Error: The specified repo-root "${REPO_ROOT}" does not exist.`));
        process.exit(1);
    } else if (!fs.statSync(REPO_ROOT).isDirectory()) {
        console.error(pc.red(`Error: The specified repo-root "${REPO_ROOT}" is not a directory.`));
        process.exit(1);
    }

    const MAX_KEEP = options["max-keep"];
    if (isNaN(MAX_KEEP) || MAX_KEEP < 0) {
        console.error(pc.red("Error: --max-keep <number> is required and must be a positive integer."));
        process.exit(1);
    } else if (MAX_KEEP === 0 && !options["skip-max-keep-zero-check"]) {
        console.warn(pc.yellow("Warning: --max-keep is set to 0, all packages will be deleted!"));
        console.warn(pc.yellow("Warning: rerun with --skip-max-keep-zero-check to skip this check and actually delete all packages."));
        process.exit(1);
    }

    const preAurPackageNames = options["preaur-config"] ? readPreAURConfigs(options["preaur-config"]) : [];
    const lilacPackageNames = options["lilac-config"] ? readLilacConfigs(options["lilac-config"]) : [];
    const existingPackageNames = [...new Set([
        ...preAurPackageNames, 
        ...lilacPackageNames
    ])]; // deduplicate package names from both configs

    let repoDbPath: string = "";
    if (existingPackageNames.length > 0) {
        const resolvedRepoDbPath = options["repo-db-path"] ? path.resolve(options["repo-db-path"]) : null;
        
        if (!resolvedRepoDbPath) {
            let detectedDbPath: string | null = null;
            // ls repo root for repo.db
            const filteredFiles = fs.readdirSync(REPO_ROOT)
                .filter(file => file.includes(".db") && !file.startsWith("pkginfo.db") && !file.endsWith(".old"));
            const dbFiles = filteredFiles.filter(file => file.endsWith(".db"));
            if (dbFiles.length === 0) {
                console.error(pc.red(`Error: No .db file found in the repo root "${REPO_ROOT}".`));
            } else if (dbFiles.length !== 1) {
                console.error(pc.red(`Error: Multiple .db files found in the repo root "${REPO_ROOT}", unable to auto-detect.`));
            } else {
                const dbArchives = filteredFiles.filter(file => file.startsWith(dbFiles[0]!) && file !== dbFiles[0]!);
                if (dbArchives.length > 1) {
                    console.error(pc.red(`Error: Found multiple archive files for "${dbFiles[0]}" in the repo root "${REPO_ROOT}", unable to auto-detect.`));
                    console.error(pc.red(`Found archive files: ${dbArchives.join(", ")}`));
                    process.exit(1);
                } else if (dbArchives.length === 0) {
                    console.error(pc.red(`Error: No archive file found for "${dbFiles[0]}" in the repo root "${REPO_ROOT}", unable to auto-detect.`));
                    process.exit(1);
                } else {
                    detectedDbPath = path.join(REPO_ROOT, dbArchives[0]!);
                    console.log(pc.green(`Using auto-detected repo db file at "${detectedDbPath}".`));
                }
            }

            if (detectedDbPath) {
                repoDbPath = detectedDbPath;
            } else {
                console.error(pc.red(`Error: No .db file provided and auto-detection failed, exiting...`));
                process.exit(1);
            }
        } else if (!fs.existsSync(resolvedRepoDbPath)) {
            console.error(pc.red(`Error: The specified repo-db-path "${resolvedRepoDbPath}" does not exist.`));
            process.exit(1);
        } else if (fs.statSync(resolvedRepoDbPath).isDirectory()) {
            console.error(pc.red(`Error: The specified repo-db-path "${resolvedRepoDbPath}" is a directory, expected a file path.`));
            process.exit(1);
        } else if (resolvedRepoDbPath.endsWith(".db")) {
            console.error(pc.red(`Error: The specified repo-db-path "${resolvedRepoDbPath}" is not a db archive.`));
            process.exit(1);
        } else {
            repoDbPath = resolvedRepoDbPath;
        }
    }

    return {
        repoRoot: REPO_ROOT,
        maxKeep: MAX_KEEP,
        force: options.force || false,
        removeOrphanFiles: options["remove-orphan-files"] || false,
        removeNonExistingPackages: options["remove-nonexisting-packages"] || false,
        existingPackageNames: existingPackageNames,
        repoDbPath: repoDbPath
    };
}