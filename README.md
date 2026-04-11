# Archavenger

Archavenger is a simple tool for cleaning up Arch Linux package repositories by removing old package versions and keeping only the most recent ones.

The name is a combination of Arch and Scavenger.

## Features
- Cleans up old package files in an Arch Linux repository
- Allows you to specify how many versions to keep per package
- Supports dry-run mode (default) and a force mode to actually delete files

## Usage

```bash
bun run archavenger.ts --repo-root <path> --max-keep <number> [--force]
```

**Options:**
- `--repo-root <path>`: Path to the root of the Arch package repository (required)
- `--max-keep <number>`: Maximum number of package versions to keep (required)
- `--force`: Actually delete old packages (default is dry-run)
- `--help`, `-h`: Show help message

## Example

```bash
bun run archavenger.ts --repo-root ./tes/preaur/repo/kpreaur --max-keep 2 --force
```

This will keep only the 2 most recent versions of each package in the specified repository and delete the rest.
