# Terminal Tools Bundle Design

## Goal

Install and integrate the next layer of terminal tooling for the user's Ubuntu 24.04 + `fish` environment: `direnv`, `atuin`, `yazi`, `btop`, and `httpie`.

## Chosen Approach

- Use Ubuntu packages for tools that are stable and available there: `direnv`, `btop`, `httpie`.
- Install `atuin` and `yazi` from their official upstream releases into `~/.local/bin` to avoid stale distro packages and avoid requiring privileged installation.
- Add isolated `fish` integration files under `~/.config/fish/conf.d/` and wrapper functions under `~/.config/fish/functions/`.
- Favor conservative behavior:
  - `direnv` auto-loads only after explicit `direnv allow`
  - `atuin` integrates with `fish` but does not steal the up-arrow binding
  - `yazi` gets a shell wrapper that can follow directory changes on exit

## Scope

- Install binaries
- Install a small set of runtime dependencies useful for `yazi`
- Configure interactive `fish` hooks and wrappers
- Verify command availability and wrapper behavior

## Verification

- Confirm each installed binary prints a version or help line
- Confirm `fish` hook files and wrapper functions parse and load
- Confirm the `yazi` wrapper follows directory changes in a controlled test
