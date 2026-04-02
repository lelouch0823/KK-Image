# Fish Terminal Enhancement Design

## Goal

Provide a pragmatic terminal quality-of-life bundle for the user's interactive `fish` shell on Ubuntu 24.04 by combining `eza`, `bat`, `fd`, `fzf`, `zoxide`, and `git-delta`.

## Scope

- Install missing CLI tools from Ubuntu packages when available.
- Keep all behavior changes limited to interactive `fish`.
- Add isolated config files under `~/.config/fish/conf.d/` and helper functions under `~/.config/fish/functions/`.
- Improve discovery, preview, navigation, and git diffs without breaking scripts or non-interactive commands.

## Chosen Approach

Use a conservative enhancement model:

- Keep `eza` as the directory lister and preserve existing shell behavior outside interactive sessions.
- Add `bat`, `fd`, `fzf`, and `git-delta` as opt-in conveniences with a few ergonomic aliases and helper functions.
- Avoid aggressive replacement of core tools like `find` and `cat` in non-interactive contexts.

## Components

### Package Layer

- `bat`: syntax-highlighted file preview
- `fd-find`: fast file finder; exposed as `fd` in shell config because Ubuntu packages the binary as `fdfind`
- `fzf`: fuzzy selector for files and directories
- `git-delta`: readable git diff/pager output

### Fish Layer

- Keep the existing `eza` aliases.
- Add aliases for `cat`, `find`, and a few navigation helpers only in interactive `fish`.
- Add helper functions for fuzzy file opening and fuzzy directory jumping.

## Error Handling

- Every shell config file checks `command -sq` before defining aliases or functions that depend on an external binary.
- The configuration should degrade cleanly if one of the optional tools is missing.

## Verification

- Confirm packages install and binaries resolve.
- Launch fresh interactive `fish` sessions and verify aliases/functions load.
- Run representative commands for listing, previewing, searching, fuzzy selection, and git diff output.
