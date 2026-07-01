# brainstorm: run skipped real api tests

## Goal

让默认 `pnpm test` 中被 skipped / pending 的 real-api 测试在正确运行口径下实际执行并通过。优先使用仓库已有 `pnpm test:real-api:*` profile 与本地 Worker 流程；如果测试失败，定位是环境启动、测试隔离还是业务回归，并修复真实问题。

## What I already know

- 用户希望“想办法通过他们”，上下文指向上一轮 `pnpm test` 中的 real-api skipped / Mocha pending 测试。
- `pnpm test` 本身已经通过；skipped/pending 不是失败，而是默认测试口径不运行 real-api 工作流。
- `scripts/run-real-api-tests.mjs` 提供 `fast`、`coverage`、`full-chain`、`*:blackbox` 等 profile。
- real-api 测试通过 `RUN_REAL_API_TESTS=1` 解锁，默认 `REAL_API_BASE_URL` 为 `http://127.0.0.1:8080`。
- 文档建议：快速真实 API 回归先启动 Worker 后跑 `pnpm test:real-api:fast`；高保真 HTTP 验收使用 `pnpm build` + `pnpm start` + `pnpm test:real-api:full-chain:blackbox`。

## Assumptions (temporary)

- 本轮目标不是把 `pnpm test` 默认行为改成运行 real-api，而是在正确 profile 下让这些测试实际通过。
- 若 `fast` profile 通过，再视时间/稳定性跑更大的 `coverage` 或 `full-chain:blackbox`。
- 如果失败来自本地 Worker 启动、D1 迁移或数据隔离，先修测试运行链路；如果失败来自业务断言，再修业务代码。

## Open Questions

- 暂无阻塞问题；先按仓库已有流程执行。

## Requirements (evolving)

- 启动或使用可访问的本地 Worker / real-api target。
- 跑通至少 `pnpm test:real-api:fast`，让默认 skipped 的 smoke real-api 文件实际执行。
- 尽可能继续跑更完整 profile，优先 `coverage` 或 `full-chain:blackbox`。
- 记录命令、失败原因、修复范围和最终结果。
- 如需改代码，按项目 specs 与测试闭环处理。

## Acceptance Criteria (evolving)

- [ ] `pnpm test:real-api:fast` 在 `RUN_REAL_API_TESTS=1` 下实际执行并通过。
- [ ] 默认 pending 的 Mocha real-api 工作流有明确的实际运行命令或覆盖替代说明。
- [ ] 如出现失败，失败被归类并修复，相关测试重跑通过。
- [ ] 提交任何必要修复与任务记录。

## Definition of Done (team quality bar)

- Tests added/updated where behavior changes require them.
- Lint / typecheck / CI relevant checks green, or documented if not applicable.
- Docs/notes updated if behavior changes.
- Rollout/rollback considered if risky.
- Trellis task archived and session recorded after commit.

## Out of Scope (explicit)

- 不为了“看起来全通过”而删除 skipped / pending gate。
- 不把高成本 real-api 黑盒测试强行并入默认 `pnpm test`。
- 不修改生产配置或真实远端环境。

## Technical Notes

- Task path: `.trellis/tasks/06-09-run-skipped-real-api-tests`
- Real-api runner: `scripts/run-real-api-tests.mjs`
- Real-api helper gate: `test/utils/manage-products-real-api.js`
- Relevant scripts: `pnpm start`、`pnpm dev:all`、`pnpm test:real-api:fast`、`pnpm test:real-api:coverage`、`pnpm test:real-api:full-chain:blackbox`
