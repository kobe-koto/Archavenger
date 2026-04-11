export function printHelp() {
    console.log(`
Usage: bun run index.ts --repo-root <path> --max-keep <number> [--force]

Options:
  --repo-root <path>    The root directory of the arch package repository (required)
  --max-keep <number>   The maximum number of package versions to keep (required), 
                        must be a positive integer. 
                        Set to 0 to delete all packages (with confirmation).
  --force               Actually delete the old packages (default is dry-run)
  --help, -h            Show this help message
    `.trim());
    process.exit(0);
}
