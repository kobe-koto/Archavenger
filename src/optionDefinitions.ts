import type { OptionDefinition } from "command-line-args";
type archavengerOptionDef = OptionDefinition & { description: string };

export const ArchavengerOptionDefs: archavengerOptionDef[] = [
    {
        name: "repo-root", alias: "r",
        type: String,
        description: "The root directory of the arch package repository (required)"
    }, {
        name: "max-keep", alias: "m",
        type: Number,
        description: "The maximum number of package versions to keep (required), must be a positive integer."
    }, {
        name: "preaur-config",
        type: String, multiple: true,
        description: "Path to PreAUR config file(s) to to remove packages that's no longer maintained."
    }, {
        name: "lilac-config",
        type: String, multiple: true,
        description: "Path to lilac PKGBUILD parent directory(s) to to remove packages that's no longer maintained."
    }, {
        name: "remove-orphan-files",
        type: Boolean,
        description: "Whether to remove orphan files that don't match any package (use with caution!)"
    }, {
        name: "remove-nonexisting-packages",
        type: Boolean,
        description: "Whether to remove packages that are not present in the repository but in the database (use with caution!)"
    }, {
        name: "force", alias: "f",
        type: Boolean,
        description: "Actually delete the old packages (default is dry-run)"
    }, {
        name: "skip-max-keep-zero-check",
        type: Boolean,
        description: "Skip the check that prevents accidental deletion of all packages when --max-keep is set to 0 (use with caution!)"
    }, {
        name: "help", alias: "h",
        type: Boolean,
        description: "Show this help message"
    }
];
export const optionDefinitions: OptionDefinition[] = ArchavengerOptionDefs.map(({ description, ...def }) => def);
