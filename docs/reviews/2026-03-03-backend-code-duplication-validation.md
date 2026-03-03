# Backend Code Duplication Validation (2026-03-03)

## Baseline Audit

- Script: `scripts/audit-backend-duplication.ps1`
- Run command: `powershell -ExecutionPolicy Bypass -File scripts/audit-backend-duplication.ps1`
- Audit time: 2026-03-03

### Baseline counts (line-match)

- Pagination duplicate pattern (`safePage/safeLimit`): 17
- JSON parsing duplication (`_parseJson` / `JSON.parse`): 39
- SpaceRepository variant image projection fragments: 12
- Timestamp mixed usage (`Date.now` / `now`): 153
- UUID direct usage (`crypto.randomUUID`): 8
- D1 change checks (`result.meta?.changes`): 9

## Validation Verdict

- [真实] SpaceRepository 重复 SQL
  - `variant_primary_image_id` / `display_image_id` 片段在多个查询中重复出现。
- [真实] JSON 解析实现分叉
  - Repository、Service、Route 层都存在手写解析和 `_parseJson` 变体。
- [部分真实] snake_case 转换
  - 存在字段映射重复，但部分位于 DTO/边界层，当前轮次不强制抽象。
- [真实] Repository 分页解析重复
  - 多处手写 `safePage/safeLimit`，默认值策略不一致。
- [真实] D1 变更检查重复
  - 多处直接依赖 `result.meta?.changes`，语义有不一致风险（如 `>= 0`）。
- [真实] UUID/时间戳策略分叉
  - `crypto.randomUUID()` 与 `generateId()` 并存，`Date.now()` 与 `now()` 并存。

## Notes

- 当前仓库全量 `pnpm test:unit` 基线并非全绿（存在既有失败），本次计划按任务定义采用定向测试验证改动正确性。
