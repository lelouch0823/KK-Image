# Fish Terminal Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install and configure a conservative terminal enhancement bundle for interactive `fish` using `eza`, `bat`, `fd`, `fzf`, `zoxide`, and `git-delta`.

**Architecture:** Use Ubuntu packages for tool installation, then layer small isolated `fish` config files and helper functions on top of the user's existing shell setup. All behavior changes remain interactive-only and every integration checks for command availability before activation.

**Tech Stack:** Ubuntu APT packages, `fish`, `eza`, `bat`, `fd-find`, `fzf`, `zoxide`, `git`, `git-delta`

---

### Task 1: Install missing CLI tools

**Files:**

- Modify: user package state only
- Verify: installed binaries in `$PATH`

- [ ] **Step 1: Install packages**

Run: `sudo apt-get update && sudo apt-get install -y bat fd-find fzf git-delta`
Expected: packages install successfully

- [ ] **Step 2: Verify binaries**

Run: `command -v batcat fdfind fzf delta`
Expected: all commands resolve

### Task 2: Add isolated interactive fish configuration

**Files:**

- Modify: `/home/bjw/.config/fish/conf.d/eza.fish`
- Create: `/home/bjw/.config/fish/conf.d/terminal-tools.fish`
- Create: `/home/bjw/.config/fish/conf.d/git-delta.fish`
- Create: `/home/bjw/.config/fish/functions/ff.fish`
- Create: `/home/bjw/.config/fish/functions/fdjump.fish`

- [ ] **Step 1: Extend interactive aliases**

Add aliases for `bat`, `fd`, and a few convenience wrappers while guarding for missing commands.

- [ ] **Step 2: Add fuzzy helper functions**

Create `ff` for fuzzy file picking with preview and `fdjump` for fuzzy directory jumping.

- [ ] **Step 3: Configure git-delta**

Set `git config --global core.pager delta` and minimal delta display defaults.

### Task 3: Verify interactive workflow

**Files:**

- Verify only

- [ ] **Step 1: Verify alias and function loading**

Run: `fish -ic 'type -q ls; type -q ll; type -q bat; type -q fd; type -q ff; type -q fdjump'`
Expected: exit code `0`

- [ ] **Step 2: Verify representative commands**

Run representative `fish -ic` commands for `ls`, `bat`, `fd`, `ff`, `fdjump`, and `git diff`
Expected: commands execute without shell errors
