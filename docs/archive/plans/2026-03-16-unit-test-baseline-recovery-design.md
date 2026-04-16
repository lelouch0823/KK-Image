# Unit Test Baseline Recovery Design

**Context**

在 AI Phase 1-3 完成后，`pnpm test:unit` 暴露出一批既有基线失败。它们不属于本轮 AI 代码直接引入的回归，但会阻塞后续继续推进 V2 总计划，因此需要先恢复全量单测基线。

**Problem Statement**

当前失败分成两大类：

1. 前端交互契约漂移
   - `ImportPreviewStep`
   - `VariantBatchBuilderModal`
   - `ProductBasicInfoSection`
   - `SalesListView`
   - `ProductCreateModal.variant-images`
2. 后端真实行为缺陷
   - `ProductVariantRepository.createBatch` 对空 SKU 处理不稳
   - `metadata.json` 与 OPA 实际权限决策不一致
   - `product patch rollback` 未守住陈旧快照边界
   - `order-batch-routes` 触发 audit helper 未处理 rejection

**SOTA Repair Principles**

1. 恢复真实语义，不做表面兼容
   - 前端优先恢复稳定的交互入口、可访问语义和可测试接口
   - 不把组件强行改回旧 DOM 结构，只修真正丢失的交互语义

2. 单一真实状态源
   - 表单和弹窗交互只允许一个 canonical state
   - 变体图片、默认值、筛选条件等不再依赖隐式副本同步

3. 领域边界兜底
   - 仓储层保证最小领域不变量，例如 variant 不能为空 SKU
   - 服务/路由层保证失败后不回放陈旧快照
   - 异步副作用必须显式捕获错误，避免未处理 rejection

4. 声明模型与执行模型一致
   - 权限 metadata 不是展示文档，而是可验证契约
   - `metadata.json` 和 OPA 决策必须重新对齐

**Recommended Execution Shape**

### Batch A: Frontend Contract Recovery

目标是恢复稳定的真实交互契约：

- `ImportPreviewStep`：冲突筛选区必须继续暴露稳定输入入口
- `VariantBatchBuilderModal`：状态选择器必须具备真实可交互语义
- `ProductBasicInfoSection`：货币选择器必须保留稳定 `v-model`
- `SalesListView`：主交互按钮必须满足可访问尺寸契约
- `ProductCreateModal`：变体图片更新必须只走单一状态源并正确提交

### Batch B: Backend Behavior Recovery

目标是恢复领域与权限边界的正确性：

- `ProductVariantRepository`：空 SKU 自动派生，不允许 silent invalid payload
- `policy/metadata.json`：与 OPA 决策重新对齐
- `product patch rollback`：失败后回滚不回放旧库存快照
- `orders/create` + audit helper：后台审计副作用必须吞掉异步错误并保持主请求可控

### Batch C: Full Regression Verification

目标是恢复全量单测基线：

- 先跑各子批受影响测试
- 再跑 `pnpm test:unit`
- 若仍有失败，继续按相同方法归类和清理，直到全绿

**Why This Design**

这个设计优于“见红修红”的原因是它按根因分层：

- 前端问题本质是交互语义和状态建模，而不是断言文字
- 后端问题本质是领域边界和副作用治理，而不是单个 if/else
- 按层修复后，后续继续 Phase 4-7 时不会继续建立在松动基线上
