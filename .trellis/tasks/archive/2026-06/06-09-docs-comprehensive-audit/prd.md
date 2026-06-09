# brainstorm: 全量 docs 文档审查与更新

## Goal

全面审查 `docs/` 文档体系，修正与当前 Vue/Hono/Cloudflare 架构、业务模块、开发命令、运维流程不一致的内容，并改善文档入口、导航、范围边界和维护约定。此次不只审查上一轮改动文件，而是覆盖活跃文档全量。

## What I already know

- 用户明确要求“全面审查文档，不要局限于这次的更改”。
- 当前仓库不是 Flutter 项目；前端是 Vue 3 + Vite，后端是 Cloudflare Pages Functions + Hono。
- `docs/` 同时包含活跃文档、用户/管理员手册、架构文档、设计系统文档、API 文档、部署文档，以及大量 `docs/archive/` 历史计划/评审。
- 活跃文档上一轮已更新过部分架构、商品投影、real API profile 和 admin feature registry 说明，但还没有做跨目录全量审查。
- 当前工作区在创建本任务前为 clean；近期提交包括 `8f63d80d docs: refresh architecture and developer guidance`。

## Assumptions (temporary)

- 本轮优先修正活跃文档：`docs/README.md`、`docs/{admin-manual,api,architecture,contributing,deployment,design-system,developer-guide,quick-start,user-manual}/`、`docs/API_REFERENCE.md`、`docs/DATABASE_SCHEMA.md`、`docs/project-summary.md`。
- `docs/archive/`、历史 `docs/superpowers/` 计划/规格默认保留历史语境，不批量改写；只在活跃索引中明确其归档性质，避免读者误用。
- 若发现需要大量代码级事实验证，先通过 repo 扫描和现有测试/脚本确认，再修改文档。

## Open Questions

- 暂无阻塞问题；先执行 repo/doc 审查，只有遇到产品语义或文档保留策略无法推断时再询问。

## Requirements (evolving)

- 覆盖活跃 docs 全量，而不是只看上一轮 diff。
- 审查并修正明显过期的目录、技术栈、命令、路由、API、数据模型、测试/部署说明。
- 保持归档文档历史性，不把旧计划改写成当前事实。
- 更新文档入口和交叉链接，使读者能区分用户手册、管理员手册、开发者文档、架构文档和归档资料。
- 记录发现的问题、修改范围和验证命令。

## Acceptance Criteria (evolving)

- [x] 建立活跃文档清单和归档边界。
- [x] 扫描并处理活跃文档中的陈旧技术栈、目录、脚本、路由/API 引用。
- [x] 检查 Markdown 链接、相对路径、图片引用和主要导航入口。
- [x] 修正与当前代码事实不一致的活跃文档。
- [x] 对不修改的历史/归档内容给出明确理由。
- [x] 运行格式、链接/路径扫描和项目相关验证。
- [x] 提交文档更新。

## Findings / Changes

- 活跃 Markdown 文档清单为 110 个文件；`docs/archive/**` 保留历史语境，不批量改写。
- 管理端逐页文档已覆盖 `src/config/admin-features.ts` 中 19 个后台 feature key。
- API 文档已覆盖 `functions/lib/hono/app.js` 中 35 个 `/api/manage/*` 挂载命名空间。
- `docs/DATABASE_SCHEMA.md` 已按迁移和 `scripts/init-database.sql` 补齐当前表清单，并移除不存在的 `order_comments` 独立表说明。
- `docs/deployment/environment-variables.md` 已补齐代码中仍引用的 env / 平台注入 / 脚本专用变量。
- `docs/superpowers/**` 的 README 已明确历史计划/规格的非权威状态。

## Verification

- `git diff --check`
- `pnpm exec prettier --check <edited markdown files>`
- Active Markdown relative link scanner: 110 files, no missing links.
- `pnpm` command reference scanner: 256 refs, all match root / minisales scripts or pnpm built-ins.
- Admin feature doc coverage: 19 / 19 feature keys covered.
- Manage API mount coverage: 35 / 35 `/api/manage/*` mounts mentioned.
- Env reference coverage: 67 discovered env refs mentioned in active docs.
- Database schema table coverage: 81 create-table refs and 76 standalone documented tables are bidirectionally consistent after excluding migration temp tables.
- `pnpm lint` passed with existing warnings only.
- `pnpm build` passed.
- `pnpm test` passed: Vitest 650 files passed / 27 skipped; Mocha 37 passing / 103 pending.
- `pnpm check:minisales` passed: minisales unit tests 19 files / 59 tests, plus TypeScript no-emit typecheck.

## Definition of Done (team quality bar)

- Tests added/updated where behavior changes require them.
- Lint / typecheck / CI relevant checks green, or documented if not applicable.
- Docs/notes updated if behavior changes.
- Rollout/rollback considered if risky.
- Trellis task archived and session recorded after commit.

## Out of Scope (explicit)

- 不重写 `docs/archive/` 内历史计划和历史评审正文，除非其索引误导读者把历史内容当现状。
- 不改业务代码，除非审查发现文档验证脚本本身有明显缺陷且必须修复。
- 不做大规模文档风格重排或视觉设计改版。

## Technical Notes

- Task path: `.trellis/tasks/06-09-docs-comprehensive-audit`
- Initial docs inventory used `rg --files docs | sort` and `find docs -maxdepth 3 -type d | sort`。
- Current package scripts include `pnpm test`、`pnpm build`、`pnpm lint`、`pnpm format`、`pnpm test:real-api:*`、`pnpm qa:*`。
