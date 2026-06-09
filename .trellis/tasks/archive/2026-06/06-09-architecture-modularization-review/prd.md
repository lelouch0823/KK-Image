# brainstorm: 架构优化与模块化拆分审视

## Goal

重新审视 KK-Image / kk-life 当前架构，判断是否需要进一步优化或模块化拆分，并优先识别能提升 locality、leverage、测试清晰度和 AI 可导航性的候选，而不是为了目录整齐做大拆分。

## What I already know

- 项目当前不是 Flutter 项目；仓库内未发现 `pubspec.yaml` 或 `.dart` 文件。
- 前端主干是 Vue 3 + Vue Router + Vite，管理端 shell 在 `src/router/index.ts`、`src/layouts/AdminLayout.vue`、`src/components/layout/Sidebar.vue` 等文件中。
- 后端主干是 Cloudflare Pages Functions + Hono，Hono shell 在 `functions/lib/hono/app.js` 中集中挂载 `/api/v1`、`/api/manage`、`/api/sales` 路由。
- 后端已经有 Repository + Domain Service + durable outbox 的主要 seam；当前不应把“目录数量多”直接等同为“需要拆包”。
- 前端 admin feature 元数据在 router、sidebar、command palette 中重复维护，存在轻量 manifest/registry 深化机会。
- 现有文档包括 `docs/architecture/system-overview.md`、`docs/architecture/modules/api-routes.md`、`docs/architecture/modules/repository-layer.md`、`docs/architecture/modules/frontend-views.md`、`docs/architecture/modules/frontend-components.md`、`docs/architecture/modules/frontend-composables.md`。

## Assumptions (temporary)

- 这轮目标是架构判断和候选排序，不直接改业务实现。
- 模块化拆分应优先围绕真实变更热点和重复配置，而不是按技术层机械拆分。
- 如果后续进入实现，前端 admin feature manifest 可以作为较小、低风险的第一步。

## Open Questions

- 是否优先把这次审视落成一个前端 shell registry / admin feature manifest 任务，还是先继续做后端 Hono route manifest / route metadata 任务？

## Requirements (evolving)

- 给出是否需要进一步模块化拆分的明确判断。
- 列出候选模块化机会，并说明问题、涉及文件、收益和风险。
- 区分“值得做的 seam”与“不建议做的大拆分”。
- 对用户提到的 Flutter shell registry 误判作出修正，并映射到本项目真实的 Vue/Hono shell。

## Candidate Opportunities

### 1. Frontend admin feature manifest / registry

- Files: `src/router/index.ts`, `src/components/layout/Sidebar.vue`, `src/composables/useCommandPalette.ts`, `src/components/layout/RecentViews.vue`, `src/components/common/ai/context-inference.ts`
- Problem: admin feature metadata is repeated across router, navigation, command palette, recent-view links, and AI context inference.
- Solution: introduce a small static admin feature manifest consumed by router/sidebar/command palette. Keep lazy page imports explicit; do not introduce runtime auto-discovery.
- Benefits: better locality for route/path/permission/title/icon changes; adding an admin feature becomes one manifest edit plus feature implementation.
- Priority: P1, recommended first.

### 2. Backend Hono route mount manifest

- Files: `functions/lib/hono/app.js`, `functions/lib/hono/routes/manage/*`, `functions/lib/hono/routes/sales.js`, `functions/lib/hono/routes/v1/*`
- Problem: `app.js` is an acceptable shell, but it now directly imports and mounts every business route, with growing "NEW" comments and repeated group shape.
- Solution: extract a static route mount manifest or helper that keeps auth/middleware ordering in `app.js` while moving mount records into one data structure.
- Benefits: improves locality for adding/removing routes and makes route inventory testable.
- Priority: P2; useful, but not as urgent as frontend feature metadata drift.

### 3. Product catalog layer direction cleanup

- Files: `functions/services/product-catalog/*.js`, `functions/lib/hono/routes/manage/products/*.js`, `functions/repositories/ProductRepository.js`, `functions/repositories/ProductRepository.ts`
- Problem: product catalog service code imports route-layer schema/normalizer modules, which makes the service depend on Hono route internals.
- Solution: move product validation/normalization contracts to a route-neutral product catalog module, with route files importing the shared contract instead.
- Benefits: restores layer direction and makes service tests less tied to route structure.
- Priority: P1/P2 depending on ongoing product-cache regression work.

### 4. Large view/component decomposition by existing feature folders

- Files: `src/views/PurchaseOrders.vue`, `src/views/Dashboard.vue`, `src/components/product/ProductImportModal.vue`, `src/components/OrderManager.vue`, `src/components/ProductManager.vue`
- Problem: several views/components are still broad orchestration surfaces.
- Solution: continue the existing pattern of extracting feature-local presentation/composable modules instead of moving the whole frontend to a new package layout.
- Benefits: reduces shallow helper proliferation while keeping behaviour testable through feature interfaces.
- Priority: P2; do opportunistically when touching the feature.

### 5. JS/TS source-of-truth clarification

- Files: repository pairs such as `ProductRepository.js` / `ProductRepository.ts`, `SpaceRepository.js` / `SpaceRepository.ts`, `NotificationRepository.js` / `NotificationRepository.ts`
- Problem: mixed JS/TS duplicates make ownership and generated/manual status unclear for maintainers and agents.
- Solution: document and enforce which file is runtime source, generated output, or migration artifact before doing more backend module splits.
- Benefits: improves AI navigability and reduces accidental edits to the wrong module.
- Priority: P2.

## Current Recommendation

Do not do a large package/module split now. The repo already has meaningful backend seams around Hono routes, services, repositories, storage providers, and durable outbox. The best next move is a small frontend admin feature manifest, followed by route-neutral product catalog contracts if the product/cache work continues to churn.

## Implementation Notes

- Implemented the P1 frontend admin feature manifest in `src/config/admin-features.ts`.
- `src/router/index.ts` now derives admin child routes from `createAdminFeatureRoutes()`.
- `Sidebar.vue`, `useCommandPalette.ts`, `RecentViews.vue`, and AI context inference now consume manifest helpers instead of maintaining separate route/icon/permission maps.
- Added `src/config/__tests__/admin-features.test.ts` to lock uniqueness, route generation, sidebar/command filtering, path inference, entity recent-view mapping, and frozen manifest behavior.
- Documented the new convention in `.trellis/spec/frontend/directory-structure.md` and `docs/architecture/modules/frontend-views.md`.
- Audited live `docs/` and refreshed navigation, architecture, developer/testing, API, quick-start, deployment, and admin-manual docs to reflect Vue 3 + Vite + Hono, admin feature manifest source of truth, product projection/cache/status ownership, and real API profile split.
- Captured the product projection/status/cache contract in `.trellis/spec/backend/quality-guidelines.md` for future backend changes.
- Backend Hono route manifest, product catalog layer direction cleanup, large view decomposition, and JS/TS source-of-truth clarification remain follow-up candidates.

## Acceptance Criteria (evolving)

- [x] 架构审视输出至少包含前端 shell、后端 route shell、domain/service/repository、测试/文档四个维度。
- [x] 每个建议都有涉及文件、问题、方案、收益。
- [x] 明确给出下一步建议和优先级。
- [x] 不提出 Flutter 相关方案。
- [x] P1 frontend admin feature manifest 已落地并有测试覆盖。
- [x] live `docs/` 已按当前架构与测试口径完成审查更新。

## Definition of Done (team quality bar)

- Tests added/updated if implementation follows.
- Lint / typecheck / CI green if code changes follow.
- Docs/notes updated if architecture contract changes.
- Rollout/rollback considered if risky.

## Out of Scope (explicit)

- 本轮不做 Flutter app shell registry。
- 本轮不做大型 monorepo/package 拆分。
- 本轮不迁移后端所有路由或前端所有页面。
- 本轮不重写状态管理框架。

## Technical Notes

- Frontend shell files inspected: `src/router/index.ts`, `src/layouts/AdminLayout.vue`, `src/components/layout/Sidebar.vue`, `src/composables/useCommandPalette.ts`, `src/composables/useAccessControl.ts`.
- Backend shell files inspected: `functions/lib/hono/app.js` and architecture docs under `docs/architecture/`.
- Initial high-signal observation: router/sidebar/command palette repeat admin feature metadata such as route path, title key, permission, icon, and labels.
- Backend route audit declarations already exist via `functions/lib/hono/_shared/audit-route-contract.js`, so route metadata work should reuse that style instead of inventing a second unrelated declaration model.
