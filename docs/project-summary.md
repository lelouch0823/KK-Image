# kk-life 项目开发总结

## 1. 项目概述

**kk-life** 是一个基于 Cloudflare Pages 的企业级全栈文件存储与业务管理平台，核心能力覆盖：

- 文件管理与共享空间
- 订单管理与销售协同
- 商品、采购与库存
- 通知、Webhook、审计与运维回放

项目已经从早期的图床/轻业务系统，演进为包含订单、采购、库存和 durable outbox 的综合业务平台。

## 2. 当前核心状态

### 业务模块

- 文件与图床
  - CAS 去重、秒传、文件夹与共享空间
- 订单系统
  - 销售端下单、管理端审核、时间轴、评论
  - 当前订单模型为 `orders` 头信息 + `order_lines` 行级履约/采购模型
- 商品与库存
  - SPU/SKU、规格、图片、库存分类账
- 采购链路
  - 采购单、部分到货、收货冲销、成本分摊
- 通知与集成
  - 站内通知、Webhook、Replay/Outbox 运维

### 架构状态

- 前端：Vue 3 + Tailwind CSS v4 + Vite
- 后端：Cloudflare Pages Functions + Hono
- 数据：Cloudflare D1 + R2
- 副作用：durable outbox 驱动通知、缓存失效、Webhook 和审计补充

## 3. 当前关键技术事实

### 3.1 订单架构

订单模块已完成两项关键升级：

1. 数据模型从单纯 `orders` 记录升级为 `orders + order_lines`
2. 关键副作用从同步调用升级为 `domain_outbox + outbox_consumer_jobs`

影响：

- 订单详情默认包含 `lines`
- 采购建议、订货总览、部分到货、冲销等流程优先依赖 `order_lines`
- `orders.procurement_status` 保留为兼容性聚合字段

### 3.2 采购与库存架构

- `purchase_orders` / `purchase_order_items`
- `purchase_receipts`
- `purchase_receipt_reversals`
- `inventory_ledger`
- `inventory_balances`

当前链路支持：

- 从已确认订单生成采购单
- 部分到货
- 收货冲销
- 手动重算成本分摊

### 3.3 Outbox 架构

关键领域事件统一写入：

- `domain_outbox`
- `outbox_consumer_jobs`
- `outbox_replay_runs`

典型消费者：

- cache
- notification
- webhook
- audit

## 4. 目录结构

```text
kk-life/
├── src/
│   ├── components/
│   ├── composables/
│   ├── modules/
│   ├── pages/
│   ├── router/
│   └── views/
├── functions/
│   ├── lib/hono/              # Hono app、middleware、routes
│   ├── repositories/          # D1 仓储层
│   ├── services/              # 领域服务、outbox、库存、采购
│   ├── api/cron/              # outbox poller 等后台入口
│   └── api/utils/             # 共享业务工具
├── minisales/
├── migrations/
├── docs/
└── public/
```

## 5. 部署与运维重点

1. D1 和 R2 是核心依赖，首启需先完成迁移与初始化。
2. 微信登录需要配置 `WECHAT_APPID` 和 `WECHAT_SECRET`。
3. 订单、采购、通知等链路需要关注 outbox poller 是否正常运行。
4. 若副作用缺失，优先检查 `/api/manage/outbox` 与 `/api/manage/audit-replay` 对应的数据和工具链。
