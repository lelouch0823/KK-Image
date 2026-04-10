# Terminal Tools Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install `direnv`, `atuin`, `yazi`, `btop`, and `httpie` and integrate them safely into the user's interactive `fish` workflow.

**Architecture:** Use Ubuntu APT for packaged tools and official upstream binaries for tools whose current releases are better consumed directly. Keep shell integration isolated in dedicated `conf.d` and `functions` files, and verify wrapper behavior with fresh interactive `fish` sessions.

**Tech Stack:** Ubuntu APT, GitHub releases, `fish`, `direnv`, `atuin`, `yazi`, `btop`, `httpie`

---

### Task 1: Install packaged tools and support dependencies

**Files:**
- Modify: user package state only

- [ ] **Step 1: Install packaged tools**

Run: `sudo apt-get update && sudo apt-get install -y direnv btop httpie ripgrep ffmpeg 7zip poppler-utils imagemagick`
Expected: packages install successfully

### Task 2: Install upstream binaries

**Files:**
- Modify: `/home/bjw/.local/bin/atuin`
- Modify: `/home/bjw/.local/bin/yazi`
- Modify: `/home/bjw/.local/bin/ya`

- [ ] **Step 1: Install latest Atuin release**

Download the current official Linux x86_64 release, verify it when possible, and install it to `~/.local/bin`.

- [ ] **Step 2: Install latest Yazi release**

Download the current official Linux x86_64 release archive, extract `yazi` and `ya`, and install them to `~/.local/bin`.

### Task 3: Add fish integration

**Files:**
- Create: `/home/bjw/.config/fish/conf.d/direnv.fish`
- Create: `/home/bjw/.config/fish/conf.d/atuin.fish`
- Create: `/home/bjw/.config/fish/functions/y.fish`

- [ ] **Step 1: Add `direnv` hook**

Source the `fish` hook only when `direnv` is installed.

- [ ] **Step 2: Add `atuin` hook**

Source the `fish` hook with conservative keybinding behavior.

- [ ] **Step 3: Add `yazi` wrapper**

Create a `y` function that runs `yazi` and follows directory changes on exit.

### Task 4: Verify end to end

**Files:**
- Verify only

- [ ] **Step 1: Verify binaries**

Run representative version/help commands for all installed tools.

- [ ] **Step 2: Verify fish integration**

Run `fish -n` on new files and `fish -ic` checks for hook availability and wrapper loading.
