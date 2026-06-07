# Lazygit Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the latest upstream `lazygit` release on Ubuntu 24.04 and add a minimal `fish` wrapper for daily use.

**Architecture:** Use the official GitHub release tarball flow recommended by upstream for Ubuntu 25.04 and earlier, verify the tarball checksum, install into `/usr/local/bin`, and add a single `fish` function for shell integration.

**Tech Stack:** GitHub releases, `curl`, `sha256sum`, `tar`, `fish`

---

### Task 1: Install lazygit from the official release

**Files:**

- Modify: system binary path `/usr/local/bin/lazygit`

- [ ] **Step 1: Resolve the latest release and download assets**

Run a shell script that reads the latest version from the GitHub API and downloads the matching Linux tarball plus `checksums.txt`.

- [ ] **Step 2: Verify the checksum and install**

Run `sha256sum -c` against the selected archive and install the `lazygit` binary into `/usr/local/bin`.

### Task 2: Add fish integration

**Files:**

- Create: `/home/bjw/.config/fish/functions/lg.fish`

- [ ] **Step 1: Add upstream-style wrapper function**

Create a `fish` function that exports `LAZYGIT_NEW_DIR_FILE`, runs `lazygit`, then changes the shell directory to the selected repo on exit.

### Task 3: Verify installation

**Files:**

- Verify only

- [ ] **Step 1: Verify binary**

Run: `lazygit --version`
Expected: installed version prints successfully

- [ ] **Step 2: Verify fish integration**

Run: `fish -n ~/.config/fish/functions/lg.fish` and `fish -ic 'type -q lg'`
Expected: both commands exit `0`
