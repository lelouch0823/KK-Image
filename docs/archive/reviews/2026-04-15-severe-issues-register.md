# 2026-04-15 Severe Issues Register

> 状态：已达到汇报阈值
> 目标：累计确认 30 个严重问题后统一汇报
> 当前已确认：30 / 30

## Verification Summary

- 复核范围：01-30 全量复核
- 复核结果：01-30 均为 `confirmed`
- 说明：这里的 `confirmed` 指代码层面的真实行为已被当前实现直接支持；后续修复时可以再细化优先级和落地边界，但不影响问题成立。

## Remediation Plan

- 修复计划文档：[docs/superpowers/plans/2026-04-15-severe-issues-remediation.md](/home/bjw/Code/KK-Image/docs/superpowers/plans/2026-04-15-severe-issues-remediation.md)
- 计划状态：completed on 2026-04-15
- 结案说明：[docs/reviews/2026-04-15-severe-issues-closure-note.md](/home/bjw/Code/KK-Image/docs/reviews/2026-04-15-severe-issues-closure-note.md)
- 覆盖范围：01-30 全量问题，按 9 个修复波次和 1 个总体验证任务编排
- 结案结果：01-02、05-30 已完成修复并有回归或发布验证证据；03 / 04 作为用户明确接受的残余风险保留。
- 范围变更：用户明确接受 03 / 04 的“分享口令明码存储”残余风险，因此执行中未将 folder / space 的分享口令改为哈希存储；相关外部传输、接口泄漏、暴力破解与过期校验仍已加固。

## 记录规范

- 仅记录会导致越权访问、敏感数据泄漏、密码学失效、资金/库存错账、不可恢复数据破坏、生产级崩溃或严重 DoS 的问题。
- 每个问题必须包含：严重性、影响、证据文件/行号、推导依据。
- 已达到 30 个严重问题并完成本轮结案；后续修复映射与验证证据见 closure note。

## Issues

### 01. 管理端/DB 用户密码使用快速 SHA-256 + 全局固定盐
- 严重性：Critical
- 影响：一旦数据库泄漏，管理员/普通后台用户密码可被高速离线撞库；同一全局盐导致整库同时失守。
- 证据：[functions/api/utils/id.js](/home/bjw/Code/KK-Image/functions/api/utils/id.js#L67C1) 直接对 `password + salt` 做一次 SHA-256；[functions/lib/hono/routes/v1/users.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/users.js#L99C1) 用该函数为后台用户写库。

### 02. 销售员密码沿用同一弱哈希方案
- 严重性：Critical
- 影响：销售端账号与后台账号同样可被离线爆破，且所有账号共享同一密钥派生策略。
- 证据：[functions/api/utils/id.js](/home/bjw/Code/KK-Image/functions/api/utils/id.js#L67C1)；[functions/repositories/SalespersonRepository.js](/home/bjw/Code/KK-Image/functions/repositories/SalespersonRepository.js#L147C1) 创建销售员时直接落库该哈希。

### 03. 文件夹分享密码以明文形式存储和比对
- 严重性：Critical
- 影响：数据库泄漏会直接暴露所有公开相册口令，内部具备读权限的接口也能看到原始密码。
- 证据：[functions/repositories/FolderRepository.js](/home/bjw/Code/KK-Image/functions/repositories/FolderRepository.js#L122C1) / [functions/repositories/FolderRepository.js](/home/bjw/Code/KK-Image/functions/repositories/FolderRepository.js#L367C1) 直接写入/更新 `password`；[functions/api/gallery/[token].js](/home/bjw/Code/KK-Image/functions/api/gallery/[token].js#L33C1) 直接与明文比较。

### 04. 共享空间密码也以明文形式存储和比对
- 严重性：Critical
- 影响：所有空间口令在数据库中可直接读取，任何数据泄漏都会变成公开空间失守。
- 证据：[functions/lib/hono/routes/manage/spaces/crud.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/crud.js#L196C1) / [functions/lib/hono/routes/manage/spaces/crud.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/crud.js#L277C1) 直接持久化 `password`；[functions/api/space/[token].js](/home/bjw/Code/KK-Image/functions/api/space/[token].js#L311C1) 直接与 `space.password` 比较。

### 05. 公开相册把口令放在 URL query 中
- 严重性：High
- 影响：密码会进入浏览器历史、Referer、CDN/网关日志和第三方监控，导致口令被动泄漏。
- 证据：[functions/api/gallery/[token].js](/home/bjw/Code/KK-Image/functions/api/gallery/[token].js#L34C1) 从 `?password=` 读取访问口令。

### 06. 公开相册完全忽略分享过期时间
- 严重性：High
- 影响：管理员以为已经到期失效的文件夹链接仍然可访问，形成永久公开暴露。
- 证据：[functions/api/gallery/[token].js](/home/bjw/Code/KK-Image/functions/api/gallery/[token].js#L16C1) 只按 `share_token` 查找；[functions/repositories/FolderRepository.js](/home/bjw/Code/KK-Image/functions/repositories/FolderRepository.js#L371C1) 明确存在 `share_expires_at` 字段但公开相册路由未检查。

### 07. 公开相册口令比较不是恒定时间比较
- 严重性：High
- 影响：密码保护接口暴露可测量的比较路径，给在线枚举/侧信道攻击留出空间。
- 证据：[functions/api/gallery/[token].js](/home/bjw/Code/KK-Image/functions/api/gallery/[token].js#L38C1) 使用普通字符串不等比较。

### 08. 共享空间密码校验没有任何独立限速或锁定
- 严重性：High
- 影响：攻击者可对公开空间口令持续暴力尝试，直到撞中正确密码。
- 证据：[functions/api/space/[token].js](/home/bjw/Code/KK-Image/functions/api/space/[token].js#L264C1) 的 POST 验证逻辑没有任何限流/失败计数；同文件 [#L316C1](/home/bjw/Code/KK-Image/functions/api/space/[token].js#L316C1) 直接返回 401 供无限试错。

### 09. 后台登录的 Turnstile 校验可通过“直接不传 token”绕过
- 严重性：High
- 影响：即使线上配置了 Turnstile，攻击者只要省略 `turnstileToken` 字段就能跳过验证码。
- 证据：[functions/lib/hono/routes/v1/auth.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/auth.js#L34C1) 仅在 `env.TURNSTILE_SECRET_KEY && turnstileToken` 时才校验。

### 10. 全局 API 限流在未绑定 KV 时直接失效
- 严重性：High
- 影响：全站 API 会在最常见的最小部署下失去节流能力，容易被暴力枚举和 DoS。
- 证据：[functions/lib/hono/middleware/rateLimit.js](/home/bjw/Code/KK-Image/functions/lib/hono/middleware/rateLimit.js#L5C1) 无 KV 直接 `next()`。

### 11. 登录失败锁定在未绑定 KV 时同样直接失效
- 严重性：High
- 影响：后台和销售登录的防爆破保护在无 KV 环境下名存实亡。
- 证据：[functions/lib/hono/middleware/rateLimit.js](/home/bjw/Code/KK-Image/functions/lib/hono/middleware/rateLimit.js#L106C1) / [functions/lib/hono/middleware/rateLimit.js](/home/bjw/Code/KK-Image/functions/lib/hono/middleware/rateLimit.js#L148C1) 在 `!kv` 时返回未锁定状态。

### 12. Cron 鉴权默认回退到公开已知的 `dev-secret`
- 严重性：Critical
- 影响：任何忘记配置 `CRON_SECRET` 的环境都会把定时任务入口暴露给持有默认口令的人。
- 证据：[functions/api/utils/cron-auth.js](/home/bjw/Code/KK-Image/functions/api/utils/cron-auth.js#L5C1) 把 `env.CRON_SECRET || 'dev-secret'` 当作生产密钥。

### 13. `/file/:id` 完全绕过文件/文件夹/空间访问控制
- 严重性：Critical
- 影响：只要拿到文件 ID 或存储键，就能直接下载本应受后台权限、分享口令或销售范围限制的文件。
- 证据：[functions/file/[id].js](/home/bjw/Code/KK-Image/functions/file/[id].js#L33C1) 到 [#L128C1](/home/bjw/Code/KK-Image/functions/file/[id].js#L128C1) 全程没有任何鉴权或可见性校验。

### 14. `/file/:id` 会继续提供已经软删除的文件
- 严重性：Critical
- 影响：进入回收站或标记删除的文件仍可通过旧链接持续访问，删除动作对外部访问无效。
- 证据：[functions/file/[id].js](/home/bjw/Code/KK-Image/functions/file/[id].js#L37C1) 查询文件时不看 `is_deleted`；[functions/repositories/FileRepository.js](/home/bjw/Code/KK-Image/functions/repositories/FileRepository.js#L221C1) 软删除仅设置标记位。

### 15. `/file/:id` 在没有数据库记录时仍会按原始 path 直接读 R2
- 严重性：Critical
- 影响：只要知道或猜到存储键，哪怕数据库记录已删，也能直接命中对象存储拿到文件。
- 证据：[functions/file/[id].js](/home/bjw/Code/KK-Image/functions/file/[id].js#L46C1) 把 path 当作 `storageKey`；同文件 [#L117C1](/home/bjw/Code/KK-Image/functions/file/[id].js#L117C1) 到 [#L123C1](/home/bjw/Code/KK-Image/functions/file/[id].js#L123C1) 在 DB 未命中时继续尝试原始 key。

### 16. 上传路径显式关闭 MIME 白名单校验
- 严重性：Critical
- 影响：攻击者可上传 SVG/HTML 等主动内容，只要扩展名不在黑名单里就会入库并被公开分发。
- 证据：[functions/api/utils/file-utils.js](/home/bjw/Code/KK-Image/functions/api/utils/file-utils.js#L160C1) 到 [#L166C1](/home/bjw/Code/KK-Image/functions/api/utils/file-utils.js#L166C1) 注释掉了 MIME 白名单。

### 17. 文件分发接口按原始 Content-Type 内联返回攻击者上传内容
- 严重性：Critical
- 影响：配合上一个问题可形成稳定的存储型 XSS/HTML 注入，且响应被长期缓存。
- 证据：[functions/file/[id].js](/home/bjw/Code/KK-Image/functions/file/[id].js#L145C1) 到 [#L166C1](/home/bjw/Code/KK-Image/functions/file/[id].js#L166C1) 直接使用对象元数据/数据库 MIME 返回内容，没有 `Content-Disposition: attachment` 或额外 CSP。

### 18. `GET /api/v1/files` 没有 `files:read` 权限门禁
- 严重性：Critical
- 影响：任何已认证用户/API Key 都能遍历文件清单并拿到直链。
- 证据：[functions/lib/hono/routes/v1/files.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/files.js#L45C1) 路由未挂 `requirePermission('files:read')`。

### 19. `GET /api/v1/files/:id` 同样缺少 `files:read`
- 严重性：Critical
- 影响：只要知道文件 ID，任意已认证主体都能读取单个文件详情和访问 URL。
- 证据：[functions/lib/hono/routes/v1/files.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/files.js#L134C1) 未做权限校验，并在 [#L144C1](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/files.js#L144C1) 返回完整文件行。

### 20. `POST /api/v1/files/check-hash` 可用原始哈希探测文件存在并直接回传 URL
- 严重性：Critical
- 影响：攻击者可对已知文件内容做 existence probing，并直接获得现有文件直链。
- 证据：[functions/lib/hono/routes/v1/files.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/files.js#L103C1) 到 [#L125C1](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/files.js#L125C1) 无权限校验且返回 `url`。

### 21. `GET /api/v1/folders` 没有 `folders:read`，还把原始文件夹行整体返回
- 严重性：Critical
- 影响：任意已认证主体都能枚举文件夹，并看到 `share_token`、`password` 等敏感字段。
- 证据：[functions/lib/hono/routes/v1/folders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/folders.js#L31C1) 未挂权限；[functions/repositories/FolderRepository.js](/home/bjw/Code/KK-Image/functions/repositories/FolderRepository.js#L313C1) 查询 `SELECT f.*`。

### 22. `GET /api/v1/folders/:id` 没有 `folders:read`，还透传完整详情
- 严重性：Critical
- 影响：任意已认证主体都能读取目标文件夹、子文件夹、文件列表的完整数据库记录。
- 证据：[functions/lib/hono/routes/v1/folders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/folders.js#L52C1) 未挂权限；[functions/lib/hono/routes/v1/folders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/folders.js#L61C1) 透传 `detail.folder/files/subfolders`；[functions/repositories/FolderRepository.js](/home/bjw/Code/KK-Image/functions/repositories/FolderRepository.js#L341C1) 明确返回 `SELECT *` 结果。

### 23. 管理端 Webhook 读接口把签名密钥直接返回给 `webhooks:read`
- 严重性：Critical
- 影响：只读权限即可窃取所有 Webhook secret，随后可伪造上游回调或横向移动到集成系统。
- 证据：[functions/repositories/WebhookRepository.js](/home/bjw/Code/KK-Image/functions/repositories/WebhookRepository.js#L4C1) 到 [#L18C1](/home/bjw/Code/KK-Image/functions/repositories/WebhookRepository.js#L18C1) 把 `row.secret` 暴露在返回对象；[functions/lib/hono/routes/manage/webhooks.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/webhooks.js#L87C1) / [functions/lib/hono/routes/manage/webhooks.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/webhooks.js#L98C1) 直接返回该对象。

### 24. v1 Webhook 读接口同样回传明文 secret
- 严重性：Critical
- 影响：旧 API 命名空间也存在同样的数据泄漏面，扩大了攻击入口。
- 证据：[functions/lib/hono/routes/v1/webhooks.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/webhooks.js#L31C1) 到 [#L43C1](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/webhooks.js#L43C1) 在 `rowToWebhook` 中暴露 `secret`；同文件 [#L49C1](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/webhooks.js#L49C1) / [#L66C1](/home/bjw/Code/KK-Image/functions/lib/hono/routes/v1/webhooks.js#L66C1) 直接返回。

### 25. AI 管理路由仅要求 `stats:read`，却允许创建客户
- 严重性：Critical
- 影响：只具备统计查看权限的账号可以借 AI 入口直接写入客户主数据。
- 证据：[functions/lib/hono/routes/manage/ai.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/ai.js#L31C1) 只校验 `stats:read`；[functions/lib/hono/routes/manage/ai.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/ai.js#L214C1) 启用 action service；[functions/ai/adapters/customer.js](/home/bjw/Code/KK-Image/functions/ai/adapters/customer.js#L1C1) 声明 `create_customer`。

### 26. AI 管理路由仅要求 `stats:read`，却允许创建订单
- 严重性：Critical
- 影响：统计只读账号可以经 AI 直接创建正式业务订单。
- 证据：[functions/lib/hono/routes/manage/ai.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/ai.js#L31C1) / [functions/lib/hono/routes/manage/ai.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/ai.js#L214C1)；[functions/ai/adapters/order.js](/home/bjw/Code/KK-Image/functions/ai/adapters/order.js#L1C1) 声明 `create_order`；[functions/ai/action-service.js](/home/bjw/Code/KK-Image/functions/ai/action-service.js#L205C1) 到 [#L208C1](/home/bjw/Code/KK-Image/functions/ai/action-service.js#L208C1) 绑定真实订单创建器。

### 27. AI 管理路由仅要求 `stats:read`，却允许创建商品
- 严重性：Critical
- 影响：低权限账号可以绕过产品管理权限，直接写入商品和变体。
- 证据：[functions/lib/hono/routes/manage/ai.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/ai.js#L31C1) / [functions/lib/hono/routes/manage/ai.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/ai.js#L214C1)；[functions/ai/adapters/product.js](/home/bjw/Code/KK-Image/functions/ai/adapters/product.js#L1C1)；[functions/ai/action-service.js](/home/bjw/Code/KK-Image/functions/ai/action-service.js#L210C1) 到 [#L213C1](/home/bjw/Code/KK-Image/functions/ai/action-service.js#L213C1) 绑定真实商品创建器。

### 28. AI 管理路由仅要求 `stats:read`，却允许创建采购单
- 严重性：Critical
- 影响：低权限账号可以借 AI 直接发起采购流程，影响库存与资金流。
- 证据：[functions/lib/hono/routes/manage/ai.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/ai.js#L31C1) / [functions/lib/hono/routes/manage/ai.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/ai.js#L214C1)；[functions/ai/adapters/purchase-order.js](/home/bjw/Code/KK-Image/functions/ai/adapters/purchase-order.js#L1C1)；[functions/ai/action-service.js](/home/bjw/Code/KK-Image/functions/ai/action-service.js#L188C1) 到 [#L203C1](/home/bjw/Code/KK-Image/functions/ai/action-service.js#L203C1) 接入采购服务。

### 29. 销售端上传接口允许把文件归档到任意订单
- 严重性：Critical
- 影响：任意销售员只要知道别人的 `orderId`，就能向该订单目录写入文件，造成越权篡改和污染。
- 证据：[functions/lib/hono/routes/sales/files.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/files.js#L20C1) 到 [#L30C1](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/files.js#L30C1) 只按 `orderId` 查 `order_no`，完全不验证订单归属。

### 30. 销售端创建/修改订单时可附加任意现有文件 ID
- 严重性：Critical
- 影响：销售员可以把不属于自己的历史文件绑定到自己的订单，甚至把文件移动进订单目录，形成跨订单/跨用户的数据劫持。
- 证据：[functions/lib/hono/routes/sales/orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/orders.js#L124C1) 到 [#L155C1](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/orders.js#L155C1) 创建订单时直接接受并迁移 `fileIds`；[functions/lib/hono/routes/sales/orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/orders.js#L351C1) 到 [#L358C1](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/orders.js#L351C1) 更新订单时继续接受任意 `fileIds`；[functions/repositories/order/mutations.js](/home/bjw/Code/KK-Image/functions/repositories/order/mutations.js#L406C1) / [functions/repositories/order/mutations.js](/home/bjw/Code/KK-Image/functions/repositories/order/mutations.js#L603C1) 直接写入 `order_files`，没有所有权校验。
