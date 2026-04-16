# 商品模块逻辑漏洞与业务未闭环审查报告

**审查日期**: 2026-03-02
**审查目标**: `products`, `product_variants`, `orders`, `purchase_orders` 相关底层数据表与核心业务代码。

根据全面审查，发现商品流转生命周期存在以下几个严重的**业务未闭环**和**逻辑漏洞**：

## 🚨 核心漏洞一：库存流转未闭环 (只增不减，致使采购建议失效)

**严重程度**: 🛑 致命

- **问题描述**：`PurchaseOrderService.js` 中当采购单到货 (`status = 'arrived'`) 时，会正确调用 `_updateInventory` 递增变体的 `stock_quantity`。**但是**，在整个系统的订单主流程中（无论是客户下单、订单确认为 `confirmed`，还是最终订单状态变为 `delivered`），**没有任何地方扣减库存**（经查阅 `OrderRepository` 和 `sales/orders` 及 `manage/orders` 路由，均无调用 `adjustStock` 扣减库存的代码）。
- **业务影响**：
  1. 物理库存只增不减，系统库存永远比实际仓库库存大且不断膨胀。
  2. 智能采购建议逻辑 (`shortage = total_demand - stock_quantity`) 会由于系统库存越来越大而计算出 `shortage < 0`，导致真正需要补货的商品不再出现在建议列表中，智能采购功能完全失效。
  3. 订单取消 (`void` / `rejected`) 时同样没有释放锁定库存的逻辑（因为一开始就没有扣减或锁定）。
- **修复建议**：必须引入**库存扣减/锁定机制**。建议在预订单创建或状态变为 `confirmed` 时**锁定/计算占用库存 (Demand)**，在订单状态变为 `delivered` (已交付客户) 时，**真正扣减**该商品变体的 `stock_quantity`，使物理库存形成完整的进销存闭环（采购到货增加 -> 在库 -> 交付减少）。

## ⚠️ 核心漏洞二：状态校验缺失 (下架商品仍可被销售开单)

**严重程度**: 🟧 高

- **问题描述**：在销售端创建订单 (`POST /sales/orders/`) 和管理端创建/更新订单时，代码仅校验了变体是否属于该商品 (`findByIdAndProductId`)，却**完全没有校验变体或商品的状态是否为 `active`**。
- **业务影响**：销售人员可以为已存档下架 (`archived`) 的商品或变体继续开单。然而，在智能采购 `getSuggestions` 的 SQL 设计中，硬编码了 `pv.status = 'active'`的过滤条件。这意味着，为 `archived` 商品下的预订单将永远不会出现在采购建议中，成为无法履约的“死单”。
- **修复建议**：在订单创建和修改绑定商品的路由逻辑中，增加 `variant.status === 'active'` 以及 `product.status === 'active'` 的强制校验。

## ⚠️ 核心漏洞三：更新变体导致并发库存覆盖 (数据丢失)

**严重程度**: 🟧 高

- **问题描述**：在 `ProductVariantRepository.syncVariants` 方法中，保存变体使用了全量字段覆盖的 UPSERT，其中包括 `stock_quantity = excluded.stock_quantity`。
- **业务影响**：并发覆写风险。如果管理员在浏览器打开了编辑商品页面（此时页面读取到的变体库存为 0），在此期间系统后台自动将刚到货的采购单入库（库存+5 变为 5）。随后管理员在不刷新页面的情况下点击“保存”商品，带有 `stock_quantity: 0` 的 payload 会触发全量 UPSERT 会将刚刚入库的 5 个库存强行覆盖写回为 0，导致库存凭空消失。
- **修复建议**：在 `syncVariants` 的 UPSERT 逻辑中，应当从 `excluded` 列表中移除 `stock_quantity`，使该字段成为只读，仅在最初 `INSERT` 时写入，后续通过专门的 `adjustStock` 接口（盘点库或进销存流水）进行原子化 `status_quantity = stock_quantity + delta` 修改。

## ℹ️ 核心漏洞四：成本核算未闭环 (分摊成本未能反哺商品库)

**严重程度**: 🟦 中 （高级闭环缺失）

- **问题描述**：在采购单完成后，`PurchaseOrderService.allocateCosts` 会把运费和关税精准分摊到每一个 `purchase_order_items` 上。但这个真实的“落地成本”（采购价 + 分摊关税与运费）仅保存在了采购单明细表中。
- **业务影响**：`product_variants.cost_price` 永远是静态的或者只能人为手动修改，这会导致在管理端的商品利润分析、报表统计以及未来的智能建议定价中，系统所使用的永远是不准确的早期预估成本价。
- **修复建议**：在采购单状态变为 `completed` (结算完成且成本已分摊) 时，触发一个异步机制，利用加权移动平均法 (Moving Average Cost) 重新计算 `product_variants.cost_price` 并回写到商品库，从而真正实现财务成本核算的闭环。

---

**下一步建议**：
以上为您所要求优先输出的问题报告。请评估这些漏洞的优先级，您可以告诉我先解决哪一个（例如：**从哪一个开始动手编写具体的 implementation plan 和修复代码？** 推荐优先修复“库存流转未闭环”与“并发库存覆盖”这两个影响核心数据的 bug）。
