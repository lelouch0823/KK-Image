# Directory Structure

> How frontend code is organized in this project.

---

## Overview

<!--
Document your project's frontend directory structure here.

Questions to answer:
- Where do components live?
- How are features/modules organized?
- Where are shared utilities?
- How are assets organized?
-->

(To be filled by the team)

---

## Directory Layout

```
<!-- Replace with your actual structure -->
src/
├── ...
└── ...
```

---

## Module Organization

### Convention: Admin Feature Manifest

Admin management-page entry metadata lives in `src/config/admin-features.ts`.

Use this manifest as the source of truth for:

- Vue Router admin child routes via `createAdminFeatureRoutes()`
- sidebar navigation via `getSidebarAdminFeatures()`
- command-palette navigation via `getCommandAdminFeatures()`
- route-path and recent-entity helpers such as `getAdminFeaturePath()` and `getAdminFeatureByEntityType()`

When adding or changing an admin feature, update the manifest first, then consume the exported helpers. Do not duplicate route path, route name, permission, title key, icon, or navigation keywords in `src/router/index.ts`, `src/components/layout/Sidebar.vue`, or `src/composables/useCommandPalette.ts`.

Good:

```ts
const routes = createAdminFeatureRoutes();
const menuItems = getSidebarAdminFeatures();
```

Bad:

```ts
// Re-declares a feature already present in admin-features.ts.
{ path: 'products', name: 'Products', permission: 'products:manage' }
```

Tests required:

- `src/config/__tests__/admin-features.test.ts` must cover uniqueness, router record generation, sidebar/command filtering, and entity recent-view mapping.

---

## Naming Conventions

<!-- File and folder naming rules -->

(To be filled by the team)

---

## Examples

<!-- Link to well-organized modules as examples -->

(To be filled by the team)
