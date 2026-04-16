# 2026-03-01 销售订单模块 V2 上线与回滚检查清单

## 1. 发布前检查

- [ ] `VITE_SALES_ORDER_V2` 配置确认（预期：`true`）
- [ ] `npx eslint src/views/sales src/components/order src/composables/sales functions/lib/hono/routes/sales` 执行
- [ ] `npm run test:unit -- src/views/sales/__tests__ src/components/order/__tests__ src/composables/__tests__/useSalesOrderApi.test.js src/composables/__tests__/useSalesOrderStateMachine.test.js functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js` 执行
- [ ] `npm run build` 执行

## 2. 灰度上线步骤

1. 测试环境开启 `VITE_SALES_ORDER_V2=true`。
2. 回归场景：
   - 列表加载/下拉刷新/分页
   - 创建（绑定商品/未绑定商品）
   - 详情加载、mark-read、评论发送
   - 统计与通知拉取
3. 生产灰度发布（建议 10%-30%-100% 三阶段）。

## 3. 监控项与阈值

核心监控（5 分钟滑窗）：

- 前端错误率（sales 路径）
  - 告警阈值：> 2%
- 创建订单失败率（`POST /api/sales/:token/orders`）
  - 告警阈值：> 5%
- 详情接口失败率（`GET /api/sales/:token/orders/:id`）
  - 告警阈值：> 3%
- 平均接口时延（p95）
  - 告警阈值：> 2s

触发任一阈值持续 5 分钟，执行回滚。

## 4. 5 分钟回滚 Runbook

目标：5 分钟内恢复旧路径默认行为。

1. 立即将 `VITE_SALES_ORDER_V2=false`。
2. 重新构建并发布前端静态资源：
   - `npm run build`
   - 按现网发布流程推送 `dist/`
3. 验证关键页面（列表、创建、详情）可正常打开与提交流程。
4. 观察 5 分钟：
   - 错误率回落到阈值以下
   - 创建成功率恢复
5. 在事故记录中补充：触发时间、指标截图、回滚完成时间。

## 5. 回滚后复盘

- 确认失败请求样本（状态码、错误码、路径）。
- 对照以下文件定位问题：
  - `src/composables/sales/useSalesOrderApi.js`
  - `src/composables/sales/useSalesOrderStateMachine.js`
  - `functions/lib/hono/routes/sales/orders.js`
  - `functions/lib/hono/routes/sales/products.js`
- 修复后先在测试环境复现并回归，再重新灰度。
