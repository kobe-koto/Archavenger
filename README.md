# Archavenger


Archavenger is a tool for cleaning up Arch Linux package repositories by removing old package versions and keeping only the most recent ones.

The name is a combination of Arch and Scavenger.

## Features
- Cleans up old package files in an Arch Linux repository
- Specify how many versions to keep per package
- Supports dry-run mode (default) and a force mode to actually delete files
- Prevents accidental deletion of all packages (with --max-keep 0 safety check)
- Supports PreAUR and lilac config files to filter packages

## Usage


```bash
bun run index.ts --repo-root <path> --max-keep <number> [options]
```

**Options:**
- `--repo-root <path>`: Path to the root of the Arch package repository (required)
- `--max-keep <number>`: Maximum number of package versions to keep (required), must be a positive integer
- `--skip-max-keep-zero-check`: Skip the safety check that prevents accidental deletion of all packages when --max-keep is 0 (use with caution!)
- `--preaur-config <file>`: Path(s) to PreAUR config file(s) to remove packages that are no longer maintained (can be specified multiple times)
- `--lilac-config <dir>`: Path(s) to lilac PKGBUILD parent directory(s) to remove packages that are no longer maintained (can be specified multiple times)
- `--force`, `-f`: Actually delete the old packages (default is dry-run)
- `--help`, `-h`: Show help message

## Example


```bash
bun run index.ts --repo-root ./tes/preaur/repo/kpreaur --max-keep 2 --force
```

This will keep only the 2 most recent versions of each package in the specified repository and delete the rest.

## Notes
- By default, the tool runs in dry-run mode and will not delete any files unless `--force` is specified.
- If you set `--max-keep 0`, all packages will be deleted unless you omit the safety check with `--skip-max-keep-zero-check`.
- You can use `--preaur-config` and `--lilac-config` to filter which packages are considered for deletion based on external config files.
