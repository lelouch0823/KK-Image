# 2026-10-03 全面审查修复计划（业务闭环 / 安全 / 性能 / 并发一致性）

> 四路独立审查（业务闭环、安全、性能、并发一致性）汇总。每条编号：
> B=业务闭环、S=安全、P=性能、C=并发一致性。证据格式 file:line 见审查原始记录。

## 决策原则

- 数据正确性 > 安全 > 性能 > 体验。凡涉及资金/库存的修复优先。
- 修复必须消除根因（收敛写入者、DB 约束、原子单语句），不做表面补丁。
- 允许重构；与现有架构模式（D1 batch 原子事务 + changes() 断言守卫 + outbox）保持一致。
- 明确不做/暂缓项在文末给出理由。

## Wave 1 — 库存守卫与订单终态清算（P0）

| ID | 问题 | 修复 |
|---|---|---|
| C-H1 | 库存扣减无原子下限守卫，`MAX(0,…)` 钳制使超卖静默、ledger 与余额永久背离 | 共享库存写语句模块：负增量带 `WHERE stock_quantity + ? >= 0` 守卫 + changes() 断言；删除全部 `MAX(0,…)` 钳制；余额 upsert 带 `on_hand/reserved/available >= 0` 谓词；迁移补 CHECK 约束（重建表）+ 缺失余额行回填 |
| C-H2 | inventory_balances 4 个语义各异的写入者（InventoryService / statement-builders / DemandService / Stocktake→Inventory）并发超预留 | 收敛为单一共享语句构建器（同上），预留持有带 `available >= 0` 谓词 |
| B-H1 | void 不释放行级预留；void 后订单行仍可 ship | void/rejected 转换时逐行释放活跃预留（复用 releaseLine 机制）；行级命令入口校验订单非 void |
| B-H2 | reserve→archive 使预留永久无法释放 | archive 路由前置校验：存在 reserved>0 行时 409 拒绝 |
| B-M1 | 订单硬删除不补偿库存，产生孤儿台账 | DELETE 路由前置校验：shipped>0 或 reserved>0 时 409 拒绝（void 已挡 shipped）；删除后发布需求投影刷新事件（增量） |
| C-M7 | variant_demand_projection 刷新 DELETE/INSERT 两步非原子，并发撞 PK | 改单 batch（与 snapshot 同范式）或 upsert |
| B-L2 | shipLine/unshipLine 不刷新 product 投影 | 补 productProjectionRefresh |

## Wave 2 — 幂等协议（P0）

| ID | 问题 | 修复 |
|---|---|---|
| C-H4 | 支付/销售建单无幂等；前端不发 Idempotency-Key；无键时服务端随机键兜底=不保护 | ① payments POST 接入 runIdempotentCommand；② 销售建单接入；③ 前端 api client 对写命令注入幂等键（按逻辑操作稳定）；④ 无键时不再静默随机——对资金/库存命令返回 400 要求显式键（配置开关 ALLOW_MISSING_IDEMPOTENCY_KEY 供过渡）|
| C-L5 | 删除付款 check-then-act | 直接 `DELETE … WHERE id=? AND order_id=?` 按 changes 判定 |
| B-M9a | 付款创建/删除无审计无事件 | scheduleAuditEvent + outbox（Wave 8 一并做退款） |

## Wave 3 — updateComposite 后门（P0）

| ID | 问题 | 修复 |
|---|---|---|
| C-H3 | 状态机校验基于陈旧读；UPDATE 无状态守卫；DELETE+重插 order_lines 清零履约进度 → 双重发货 | ① orders 加 `version` 列（迁移），updateComposite 与 updateStatus 统一 `WHERE version=?` 乐观锁，冲突 409；② 行编辑禁止 delete-and-reinsert：改为逐行 upsert（按 id 匹配则守卫更新、保留履约进度），删除行时有进度（shipped/received/reserved>0）则拒绝；③ 编辑期间订单级资源锁（复用 order-procurement-resource-locks 模式） |

## Wave 4 — 安全（P1）

| ID | 问题 | 修复 |
|---|---|---|
| S-H1 | 生产可能用仓库默认 JWT_SECRET/BASIC_PASS，无运行时护栏 | verifyJWT/签发入口：ENVIRONMENT=production 且 secret 命中已知默认值/长度不足时 fail-closed 抛错；BASIC_PASS 同理（登录入口） |
| S-M1 | OAuth token 明文入库且列表接口回显明文 | 存 SHA-256(token)；查询按 hash；存量明文懒升级；列表只回前缀掩码 |
| S-M2 | OAuth 授权码消费 check-then-act 双花 | `UPDATE … SET used=1 WHERE code=? AND used=0` 按 changes 判定，原子 |
| C-M1 | refresh 轮换 revoke/issue 分离，并发双发 | revoke 改条件更新按 changes 判定，同 batch 内签发新 token |
| S-L7 | revoked refresh token 重放无 token family 吊销 | 刷新时发现 token 已 revoked → 吊销该 client 全部 token + 401 |
| S-M3 | CORS 未配置时对全来源返回 * | 默认不返回 CORS 头（同源策略）；development 显式放开 |
| S-L1 | 401 回显内部 JWT 错误 | 统一固定文案，细节入日志 |
| S-L3 | Turnstile 未传 remoteip/未校验 hostname | 传 remoteip；校验 hostname 与请求 Host 一致 |
| S-L4 | Turnstile 限流 per-isolate Map | 复用 KV 限流工厂 |
| S-L6 | withCache 缓存键不含身份 | 键并入 actor 摘要 |
| S-L8 | OAuth token 64bit 熵 | 升级 128bit（32 hex） |
| S-L2 | /api/v1/auth/token 无 Turnstile | API 端点面向 SDK 无法接 Turnstile → 保持 KV 锁定+限流并收紧阈值（理由见文末） |

## Wave 5 — 投影/统计/软删（P1）

| ID | 问题 | 修复 |
|---|---|---|
| C-M6 | 软删文件计入统计（Stats/SystemStats→projection 永久虚高）、软删文件夹出现在分享列表 | 统一 `is_deleted` 过滤（StatsRepository/SystemStatsRepository/FolderRepository 分享列表） |
| P-H3 | effective_delivery_status CASE 包裹使 0072 索引失效 | 物化列 + 触发器/回填（迁移），查询改裸列过滤 |
| P-H2 | 订单列表 CASE 排序 + OFFSET 深翻页 | status_priority 物化列排序（索引可满足）；OFFSET 保留（前端分页 UI 依赖，深翻页风险记录在案） |
| B-M3 | deadline 扫描含幽灵状态 in_progress、不过滤归档 | 改合法状态集合 + `archived_at IS NULL` |
| C-M7b | 投影无周期对账兜底 | 新增 reconcile cron：低频重算 demand/snapshot/product 投影（分批） |

## Wave 6 — 采购 / ERP / Outbox / 缓存（P1）

| ID | 问题 | 修复 |
|---|---|---|
| C-M2 | pre_order 绑定 check-then-act，并发双重采购 | createFromOrders/校验入口接入订单级资源锁（purchase-order-item 锁定 pre_order ids），DB 层补部分唯一索引兜底（视 items 生命周期语义） |
| B-M4 | PO 取消不回滚订单 procurement_status | cancelled 转换级联重置订单 procurement_status（回 pending 语义），completed 语义确认后处理 |
| B-M5 | 短缺关闭不发领域事件 | 复用 reversal 模式发 outbox 事件（order_procurement_shortage_closed） |
| C-L1 | 收货 batch 内无 PO status 守卫 | batch 首条加条件 UPDATE + changes 断言 |
| C-L2 | 收货 outbox payload on_hand_after 陈旧 | payload 改带 delta |
| C-M3 | ERP 同步无水位/无互斥/webhook 无去重 | connection 行存 last_synced_at 水位原子推进；同步租约（复用 OutboxRuntimeState lease 模式或 KV 租约）；webhook 事件去重表 + INSERT OR IGNORE |
| C-M5 | outbox lease 过期双跑；webhook 送达无去重 | webhook_deliveries(event_id, endpoint_id) 唯一 + INSERT OR IGNORE；租约期改可配置并留量；email/audit 消费者幂等核查 |
| P-H1 | 缓存失效 fan-out 数百 subrequest + 每 URL 双删 | 代际失效：KV generation counter（短 isolate memo），withCache 键并入 gen，cache consumer 改 bumpGen，删除 URL 笛卡尔积 fan-out |
| B-L3 | channelNotify 消费者悬空 | 注册表与 cron 白名单对齐（单一 ACTIVE_CONSUMERS 来源，消除漂移） |
| B-L4 | 死信 7 天销毁、无告警 | 任务耗尽时发管理员通知+审计；exhausted 保留期 7d→30d |
| C-L6 | batchUpdateStatus 后 demand 同步非原子 | demand 同步移入 outbox 消费者（事件已发布则消费侧补齐） |

## Wave 7 — 性能（P2）

| ID | 问题 | 修复 |
|---|---|---|
| P-M1 | 创建订单逐行串行校验变体绑定（N+1） | 收集后 IN 批量校验 |
| P-M2 | SpaceRepository.findAll 全表+JS 过滤 | SQL 层 parent_id 过滤参数化 |
| P-M3 | 备份 OFFSET 翻页 O(n²) | rowid keyset 翻页 |
| P-M4 | 订单删除触发 variant_snapshot 全表重建 | 先取 DISTINCT variant_id 走增量 refresh |
| P-M5 | 商品列表每页两条 DISTINCT 全量 | 品牌分类列表短 TTL 缓存（cache-gen scope） |
| P-M6 | 通知双轮询 + 每请求 schema 探测 | 保留单轮询；_checkColumnExists 模块级 memo |
| P-H4 | GoodsOverview 每请求全量成本聚合 | 结果缓存（cache-gen scope goods_overview，收货/PO 事件失效）|
| P-H5 | PWA 预缓存 4.6MB 全部 JS；xlsx 双份 | precache 收窄 entry+核心 vendor，路由 chunk runtimeCaching；移除 xlsx 依赖统一 xlsx-js-style |
| P-L2 | jszip 静态导入进分享页 chunk | 动态 import |
| P-L3 | Stats 轮询无 visibility 守卫 | visibilitychange 守卫 |
| P-L1 | 文件请求 no-store 每图 3 D1+1 R2 | 不改缓存头（鉴权文件防泄漏优先），优化 OR 双列为两次点查 |

## Wave 8 — 支付域 / 退货冲正 / 存储闭环 / MAC（P2）

| ID | 问题 | 修复 |
|---|---|---|
| B-M9 | 支付域无退款概念、退货无支付联动、删除付款无审计 | payments 加 `type`（payment/refund，refund 存负额）+ 退款路由（退款≤已付-已退，事务校验）+ 审计 + timeline + outbox；删除付款（仍保留为冲正手段）补审计 |
| B-M2 | order_returns 4 态仅 1 态可达，误退货无法冲正 | 实现 `cancelled` 冲正命令（反向库存事件 + 状态更新）；requested/received 保留为预留枚举（文档说明） |
| B-M6 | trash 彻底删除不清镜像/R2 删除失败继续删 DB | 清理 storage_mirrors 行+镜像副本；R2 删除失败则中止 DB 删除 |
| B-M7/B-M8 | 多存储镜像子系统未接线/失败无重试 | 修复 trash 清理+失败标记后，模块保留但明确标注未启用；不强行接线（接线引入每读 1 次 D1 的常态开销而当前无镜像部署，理由见文末） |
| C-M4 | 成本分摊 MAC 反解覆盖写 | 改单语句 batch 内正算：`(cost_price*(stock_quantity-?)+landed)/stock_quantity` 原子更新 + allocate 端点幂等 |
| C-L4 | 跨行并发退货互相 409 | 不改（正确性无虞，纯可用性），见文末 |
| B-L1 | rejected→pending 不对称 | 不改（语义可接受），见文末 |
| B-L5 | 采购建议无采纳状态 | 不改（读模型+绑定冲突检查已兜底），见文末 |

## 验证

- `pnpm lint`、`pnpm typecheck:frontend`、`pnpm test:unit:run`、`node scripts/run-mocha-tests.mjs`
- 迁移前缀检查 `pnpm db:migrations:check-prefix`
- 相关路由测试逐模块跑（test:audit 清单）

## 明确不做 / 暂缓（理由）

- **S-L2 Turnstile on API token endpoint**：该端点供 SDK/程序化客户端使用，Turnstile 是浏览器交互式挑战，接入即破坏 SDK；以 KV 锁定+限流兜底，并收紧阈值。
- **P-H2 完全 keyset 化订单列表**：前端分页 UI（页码跳转）依赖 OFFSET；本轮物化排序键消除全量排序，keyset 迁移需前端协议改造，单列后续任务。
- **B-M7 镜像子系统接线**：无镜像配置部署下接线只会给每次文件读取增加 1 次 D1 查询的常态开销；先修复其引用完整性（B-M6），接线作为 feature 另行排期。
- **C-L4 / B-L1 / B-L5**：正确性无虞或已有兜底，收益/风险比不划算，记录在案。
- **P-L1 缓存头放宽**：鉴权文件缓存有越权回放窗口（分享撤销后 TTL 内仍可读），维持 no-store。


---

## 实装状态（As-Built, 2026-10-03）

全部 Wave 已实施，与计划的偏差：

1. **C-H3 采用状态守卫而非 version 列**：updateComposite 的 UPDATE 补
   `AND status = ?` 乐观锁（与 updateStatus/batchUpdateStatus 的既有模式一致），
   同一不变量下少一次 schema 变更；行结构重写改为"存在履约进度即拒绝"。
2. **订单级预留允许超储（backorder 语义）**：0099 CHECK 仅约束
   on_hand/reserved 非负；available 恒重算为 MAX(on_hand - reserved, 0)
   （与 InventoryBusinessWorkflow 业务规格一致）。行级硬预留由
   buildGuardedHoldUpsertStatement 的 WHERE 谓词 + changes() 断言守卫。
3. **P-H2**：OFFSET 分页保留（前端页码 UI 依赖），P-H3 物化列过滤已消除
   全表扫描；完整 keyset 迁移列为后续任务。
4. **P-H4**：goods-overview 已有 withCache(20) + 新代际失效正确覆盖，
   未再做物化表；全量聚合仅发生在缓存未命中时。
5. **P-M2**：复核发现 SpaceRepository 两条查询均已带 `parent_id IS NULL`
   过滤（审查报告过时），未改动。
6. **B-M2**：实现了可操作的 `cancelled` 冲正命令（反向库存事件 +
   状态翻转 + 幂等 + 审计）；requested/received 保留为预留枚举。
7. **退款（B-M9）**：payments 重建（type 列 + CHECK(amount!=0)），
   退款负额入账使全部 SUM(amount) 汇总自然净额化；
   (order_id, reference_no) 唯一索引 + 历史重复清理。

## 新增交付物

- migrations/0099（余额表 CHECK+回填）、0101（payments type/唯一索引）、
  0102（ERP webhook 去重表）、0103（webhook 投递尝试唯一索引）
- functions/services/_shared/inventory-write-statements.js（库存唯一写入点）
- functions/services/order-terminal-cleanup.js（终态预留清算）
- functions/api/utils/secret-guard.js（生产密钥护栏）
- functions/lib/hono/_shared/cache-generation.js（代际失效）
- functions/api/cron/reconcile.js（投影对账 cron）
- src/utils/idempotency.ts（前端幂等键注入）
- 退款 API + UI（POST /:id/refunds、OrderPaymentCard 退款表单）
- 退货冲正 API（POST /:id/lines/:lineId/returns/:returnId/cancel）


---

## P-H2 后续评估（2026-10-03，经二次实测修正）

原计划将 keyset 分页列为后续任务。第一轮实测（5 万订单）后曾结论
"表达式索引 + COUNT 去 join，keyset 搁置"，但其中"深页 0.7ms"的读数
测量口径有误（测的是无 `archived_at IS NULL` 过滤的变体，而真实查询
永远携带该过滤）。修正测量后发现问题并二次修复：

### 测量口径修正与部分索引

归档过滤不在索引内时，OFFSET 跳过的每一行都要回表判断 archived_at，
深页退化为线性回表（5 万单最后一页实测 **66.7ms**，非 0.7ms）。
**修复：0104 改为部分索引**（`WHERE archived_at IS NULL` 内建于索引），
深页变回纯索引游标走。

### 最终数据（50 万单 = 10 倍设计规模压测）

| 场景 | 无索引（改前） | 非部分索引 | **部分索引（0104 最终版）** |
|---|---|---|---|
| 默认视图 第 1 页 | ~340 ms | 0.1 ms | **0.03 ms** |
| 默认视图 第 100 页 | ~340 ms | — | **0.13 ms** |
| 默认视图 最后一页（第 25000 页） | ~340 ms+ | ~600 ms（线性回表） | **29.7 ms** |
| COUNT(*)（无投影筛选） | ~190 ms | — | **~55 ms** |
| includeArchived 视图（罕见） | 同左 | ~205 ms | 回退阻塞排序 ~205 ms（已记录取舍） |

### keyset 分页：正式否决（理由不是开发时间）

部分索引落地后，用户实际访问的页深（第 1~100 页，50 万单内）
OFFSET 与 keyset 的差距在 **0.1ms 量级**。keyset 的残余收益与真实成本：

- 残余收益：① 第 12501 页起才有数量级优势（无人访问的页深）；
  ② 并发插入下迭代稳定（翻页中新建订单可能看到重复行）——
  若将来导出全量需要稳定游标，应做专用导出端点而非改列表 API。
- 真实成本（非时间）：① **UX 回退**——keyset 天然不支持"跳转到第 N 页 /
  跳到最后一页"，而这恰是深页的唯一现实入口（看最早订单），补救需
  反向游标+双向分页，复杂度翻倍；② **cursor 与筛选条件的一致性**
  （翻页中改筛选会产出错误结果，需在 cursor 内编码筛选指纹）；
  ③ 收藏/分享 URL 与前进后退语义；④ 与全站其余十余个列表的
  page/offset 协议长期双轨并存。

结论：0104（部分表达式索引）+ COUNT 条件 join 即为该问题的完整解，
keyset 在可预见的规模内没有标的。
