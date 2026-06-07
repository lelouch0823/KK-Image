# Code Review Findings: main vs main

Date: 2026-03-02
Baseline: `git diff 7d42b88165c92e1654f2982256c881f28b8f5276`

## Scope

整理本次 review 中确认的 4 个问题，聚焦 AI 路由行为回归与订单缓存失效一致性。

## Summary

- 总问题数: 4
- P1: 1
- P2: 3
- 结论: 当前补丁不应视为完全正确，需先完成修复并回归验证。

## 1) [P1] Vision-first 作用范围过宽，导致后续文本轮次工具被禁用

- 文件: `functions/lib/hono/routes/manage/ai.js`
- 位置: `hasImageInUserHistory`（约第 162 行）
- 问题描述:
  当前逻辑扫描整段历史消息，只要历史任意用户消息含图片，后续纯文本轮次仍会进入 `visionFirst=true`，从而让 `callAI/callAIStream` 走 `tools=[]`。
- 触发条件:
  同一会话中先发过图片，再发工具依赖型文本问题（例如需要查订单/商品的问题）。
- 影响:
  工具调用长期被关闭，导致问答准确性下降，出现“该查数据但未查”的行为回归。
- 修复建议:
  将 vision-first 判定限制在“当前用户轮次”（通常是最后一条 user message）而非全量历史。
- 回归验证:
  先发一条含图消息，再发一条仅文本且需工具调用的问题，确认工具调用恢复正常。

## 2) [P2] 管理端订单列表启用缓存后，缺少已读态失效

- 文件: `functions/lib/hono/routes/manage/orders/list.js`
- 位置: `app.get('/', withCache(20), ...)`（约第 12 行）
- 问题描述:
  管理端列表增加缓存后，`manage/orders/detail` 中的 `markAsRead(id, 'admin')` 未联动失效列表缓存。
- 触发条件:
  管理员打开订单详情触发已读更新，然后立即返回订单列表。
- 影响:
  在 TTL 窗口内，列表 `is_unread` 和“未读优先排序”可能展示旧状态。
- 修复建议:
  在管理端订单 read 状态变更处补充 `/api/manage/orders` 与相关查询参数缓存失效，或降低该类读写敏感接口缓存策略。
- 回归验证:
  打开未读订单详情后立即返回列表，确认未读标记与排序实时更新。

## 3) [P2] 销售端订单已读后未失效列表缓存

- 文件: `functions/lib/hono/routes/sales/orders.js`
- 位置: `app.get('/', withCache(20), ...)`（约第 24 行）
- 相关路径: `GET /:id` 与 `PATCH /:id/read` 中 `markAsRead(..., 'sales')`
- 问题描述:
  销售端列表开启缓存后，订单被标记已读时没有失效 `/api/sales/:token/orders` 相关缓存。
- 触发条件:
  销售员查看订单详情或点击已读后返回列表。
- 影响:
  列表未读标识与排序在 TTL 时间内可能滞后。
- 修复建议:
  在销售端 read 变更路径补充 sales order list/stats 缓存失效（按 token 维度）。
- 回归验证:
  未读订单进入详情后返回列表，确认未读态即时消失，排序随之更新。

## 4) [P2] 销售留言触发管理员未读，但未失效管理端订单列表缓存

- 文件: `functions/lib/hono/routes/sales/orders.js`
- 位置: 评论接口末尾 `invalidateCache(getOrderNotificationCacheUrls(c))`（约第 351 行）
- 问题描述:
  该流程调用 `setUnread(orderId, 'sales')` 改变管理员未读态，但只失效通知缓存，没有失效管理端订单列表缓存。
- 触发条件:
  销售员新增评论后，管理员立刻查看订单列表。
- 影响:
  管理端列表 unread 与排序可能未及时反映新评论导致的未读变化。
- 修复建议:
  在评论接口补充管理端订单列表（及必要统计）缓存失效，与 unread 状态更新保持一致。
- 回归验证:
  销售端新增评论后，管理员刷新列表应立刻看到对应订单未读标记变化。

## Suggested Fix Order

1. 先修复 P1（AI tool 调用正确性风险更高）。
2. 再统一梳理订单 read/unread 相关缓存失效路径（管理端与销售端一起收敛）。
3. 增加针对 read/unread + cache 的回归测试，避免后续同类回归。
