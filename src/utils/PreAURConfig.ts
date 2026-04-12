import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { YAML } from "bun";

// returns all package name in the PreAUR config files
export function readPreAURConfigs (paths: string[]) {
    const packageNames = [];
    for (const p of paths) {
        try {
            const configContent = readFileSync(path.resolve(p), "utf-8");
            const config = YAML.parse(configContent) as { packages?: { pkgname: string }[] };
            // Assuming the YAML structure has a 'packages' array
            if (Array.isArray(config.packages)) {
                packageNames.push(...config.packages.map((pkg) => pkg.pkgname));
            } else {
                console.warn(`Warning: PreAUR config file "${p}" does not contain a "packages" array.`);
            }
        } catch (err) {
            console.error(`Error reading PreAUR config from "${p}": ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    }
    // unique package names
    const uniquePackageNames = new Set(packageNames);
    return Array.from(uniquePackageNames);
}
