# Lazygit Installation Design

## Goal

Install the latest official `lazygit` release on Ubuntu 24.04 and integrate it into the user's interactive `fish` workflow with minimal, predictable shell glue.

## Chosen Approach

- Use the upstream GitHub release tarball because the upstream README recommends that path for Ubuntu 25.04 and earlier.
- Resolve the latest release tag dynamically from the GitHub API at install time.
- Download the matching `Linux_x86_64` asset and verify it against the published `checksums.txt`.
- Install the binary into `/usr/local/bin`.
- Add a `fish` wrapper function named `lg` that follows the upstream documented pattern for changing the shell directory after exiting `lazygit`.

## Scope

- Install `lazygit`
- Add `fish` integration only
- Avoid broad `lazygit` UI config changes unless required for functionality

## Verification

- Confirm the installed version with `lazygit --version`
- Confirm the `lg` function loads in a fresh interactive `fish`
- Syntax-check the new `fish` function file
