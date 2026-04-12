import commandLineArgs from "command-line-args";
import { commandLineUsages } from "./commandLineUsages.ts";
import { optionDefinitions } from "./optionDefinitions.ts";
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

    return {
        repoRoot: REPO_ROOT,
        maxKeep: MAX_KEEP,
        force: options.force || false
    };
}