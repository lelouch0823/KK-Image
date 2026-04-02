# AI Config Manager Factory Wrapper Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the exported `createAIConfigManager` factory wrapper so config-manager tests construct `AIConfigManager` directly.

**Architecture:** Add a static audit test forbidding `config-manager.js` from defining `createAIConfigManager`, then delete the wrapper and update `config-manager.test.js` to instantiate the class with `new AIConfigManager(env.DB, env)`. Use the existing config-manager tests as regression coverage.

**Tech Stack:** Vitest, ESLint, AI config manager module

---

### Task 1: Lock the Cleanup Contract

**Files:**
- Create: `functions/ai/__tests__/config-manager-factory-wrapper.audit.test.js`

- [ ] **Step 1: Write the failing audit test**

Add a static test asserting `functions/ai/config-manager.js` no longer defines `createAIConfigManager`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/ai/__tests__/config-manager-factory-wrapper.audit.test.js
```

Expected: FAIL because the factory wrapper still exists.

### Task 2: Remove the Factory Wrapper

**Files:**
- Modify: `functions/ai/config-manager.js`
- Modify: `functions/ai/__tests__/config-manager.test.js`

- [ ] **Step 1: Delete the wrapper and update tests**

Remove `createAIConfigManager` and switch tests to direct `AIConfigManager` construction.

- [ ] **Step 2: Run focused verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/ai/__tests__/config-manager-factory-wrapper.audit.test.js functions/ai/__tests__/config-manager.test.js
```

Expected: PASS

- [ ] **Step 3: Run broader impacted verification**

Run:

```bash
node /home/bjw/Code/KK-Image/node_modules/eslint/bin/eslint.js functions/ai/config-manager.js functions/ai/__tests__/config-manager.test.js functions/ai/__tests__/config-manager-factory-wrapper.audit.test.js
node /home/bjw/Code/KK-Image/node_modules/vitest/vitest.mjs run functions/ai/__tests__/config-manager-factory-wrapper.audit.test.js functions/ai/__tests__/config-manager.test.js functions/lib/hono/routes/manage/__tests__/ai-routes.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-ai-config-manager-factory-wrapper-cleanup-design.md docs/superpowers/plans/2026-04-02-ai-config-manager-factory-wrapper-cleanup-plan.md functions/ai/config-manager.js functions/ai/__tests__/config-manager.test.js functions/ai/__tests__/config-manager-factory-wrapper.audit.test.js
git commit -m "refactor: remove ai config manager wrapper"
```
