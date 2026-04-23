import fs from "node:fs";
import path from "node:path";

// structure of lilac parent directory is like this:
// lilac-configs (parent)/
// ├── pkg/
// │   ├── PKGBUILD
// │   ├── lilac.yaml
// │   └── ...
// ├── pkg2/
// │   ├── PKGBUILD
// │   ├── lilac.yaml
// │   └── ...
// └── ...

// returns all package name in the Lilac config files
export function readLilacConfigs(PkgbuildParentPaths: string[]): string[] {
    const packageNames: string[] = [];
    for (const PkgbuildParentPath of PkgbuildParentPaths) {
        // iterate all subdirs (that have lilac.yaml and PKGBUILD) in the parent dir
        const subdirs = fs.readdirSync(PkgbuildParentPath, { withFileTypes: true })
            .filter(item => item.isDirectory())
            .filter(dir => {
                // list all files and dirs in the subdir, check if both lilac.yaml and PKGBUILD exist
                const fileList = fs.readdirSync(path.join(PkgbuildParentPath, dir.name), { withFileTypes: true });
                const hasPKGBUILD = fileList.some(file => file.isFile() && file.name === "PKGBUILD");
                const hasLilacYaml = fileList.some(file => file.isFile() && (file.name === "lilac.yaml" || file.name === "lilac.yml"));
                return hasPKGBUILD && hasLilacYaml;
            })
            .map(i => i.name);
        // read PKGBUILD in each subdir, and extract pkgname
        for (const subdir of subdirs) {
            const pkgbuildPath = path.join(PkgbuildParentPath, subdir, "PKGBUILD");
            try {
                const pkgbuildContent = fs.readFileSync(pkgbuildPath, "utf-8");
                // extract pkgname from PKGBUILD
                const pkgnameArrayMatch = pkgbuildContent.match(/^\s*pkgname\s*=\s*\(([\s\S]+?)\)\s*$/m);
                if (pkgnameArrayMatch !== null && pkgnameArrayMatch[1] !== undefined) {
                    const pkgnameArrayContent = pkgnameArrayMatch[1];
                    const pkgnameArray = pkgnameArrayContent.replace(/\n/g, " ").split(/\s+/).filter(Boolean);
                    packageNames.push(...pkgnameArray);
                } else {
                    const pkgnameMatch = pkgbuildContent.match(/^\s*pkgname\s*=\s*(['"]?)(.+?)\1\s*$/m);
                    const pkgname = pkgnameMatch ? pkgnameMatch[2] : null;
                    if (pkgname) {
                        packageNames.push(pkgname);
                    } else {
                        console.warn(`Warning: Could not find pkgname in PKGBUILD at "${pkgbuildPath}". Skipping this PKGBUILD.`);
                    }
                }
            } catch (err) {
                console.error(`Error reading PKGBUILD from "${pkgbuildPath}": ${err instanceof Error ? err.message : String(err)}`);
                process.exit(1);
            }
        }
    }
    return packageNames;
}