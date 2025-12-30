# 📋 订单系统功能开发计划 (Order System Roadmap)

> 本文档记录订单管理系统的功能增强计划，按优先级和复杂度分类。  
> 使用 `[ ]` / `[x]` 标记进度。

---

## 🟢 Phase 1: 简单改进 (Low Effort)

### 1.1 订单快捷操作
- [ ] 一键复制订单
- [ ] 键盘快捷键导航

**实现思路**:
```
📁 src/components/order/OrderDetail.vue
   - 添加"复制订单"按钮，调用 createSalesOrder() 并预填数据
   
📁 src/composables/useOrders.js
   - 新增 duplicateOrder(orderId) 方法
   
📁 src/OrderApp.vue
   - 集成 @vueuse/core 的 useMagicKeys 或原生 keydown 监听
   - ↑↓ 切换选中, Enter 打开详情
```

---

### 1.2 消息通知增强
- [ ] 订单状态变更桌面通知
- [ ] 销售端新消息红点提醒

**实现思路**:
```
📁 src/composables/useNotification.js (NEW)
   - 封装 Notification.requestPermission() + new Notification()
   - 提供 showNotification(title, body, onClick) 方法
   
📁 src/OrderApp.vue
   - 轮询 /api/sales/:token/orders 检查 hasNewFeedback
   - 或使用 SSE/WebSocket (进阶)
   
📁 src/components/order/OrderList.vue
   - 在卡片上显示红点 badge (已有 hasNewFeedback 字段)
```

---

### 1.3 搜索体验优化
- [ ] 支持模糊匹配
- [ ] 搜索结果关键词高亮
- [ ] 搜索历史记录

**实现思路**:
```
📁 functions/api/manage/orders/index.js (已有搜索逻辑)
   - 当前: WHERE current_data LIKE ?
   - 优化: 支持多字段搜索 (order_no, name, remark)
   
📁 src/components/OrderManager.vue
   - 使用 localStorage 存储最近 5 条搜索记录
   - 搜索框下拉显示历史
   
📁 src/utils/highlight.js (NEW)
   - 提供 highlightText(text, keyword) 工具函数
```

---

### 1.4 表单体验提升
- [ ] "最近使用"快速填充
- [ ] 图片拖拽排序

**实现思路**:
```
📁 src/composables/useRecentInputs.js (NEW)
   - 使用 localStorage 存储最近输入的 name/size/color/material
   - 提供 getRecent(field) / saveRecent(field, value) 方法
   
📁 src/components/order/OrderForm.vue
   - 输入框 focus 时显示下拉建议
   
📁 src/components/common/ImageUploader.vue
   - 集成 @vueuse/core 的 useSortable 或原生 drag API
   - 替换当前 uploadedImages 数组顺序
```

---

## 🟡 Phase 2: 中等复杂度 (Medium Effort)

### 2.1 数据导出功能
- [ ] 导出订单为 Excel
- [ ] 支持筛选条件 + 日期范围

**实现思路**:
```
📁 functions/api/manage/orders/export.js (NEW)
   - GET /api/manage/orders/export?format=xlsx&status=...
   - 使用 xlsx 库生成 Excel (Cloudflare Workers 兼容)
   
📁 src/components/OrderManager.vue
   - 添加"导出"按钮
   - 调用导出 API 并下载文件

依赖: npm install xlsx
```

---

### 2.2 批量操作
- [ ] 批量选择订单
- [ ] 批量确认/驳回
- [ ] 批量导出图片 ZIP

**实现思路**:
```
📁 src/components/order/OrderTable.vue
   - 添加 checkbox 列
   - 维护 selectedIds: ref([])
   
📁 functions/api/manage/orders/batch.js (NEW)
   - POST /api/manage/orders/batch
   - body: { action: 'confirm'|'reject', ids: [...], reason }
   
📁 src/composables/useOrders.js
   - 新增 batchChangeStatus(ids, status, reason) 方法
```

---

### 2.3 管理端仪表盘
- [ ] 订单概览卡片 (今日/待处理/本周)
- [ ] 订单趋势图表

**实现思路**:
```
📁 functions/api/manage/dashboard.js (NEW)
   - GET /api/manage/dashboard
   - 返回: todayCount, pendingCount, weeklyTrend[]
   
📁 src/views/Dashboard.vue (NEW)
   - 统计卡片组件
   - 使用 Chart.js 或 ECharts 绘制趋势图
   
📁 src/router/admin.js
   - 添加 /admin/dashboard 路由
```

---

### 2.4 销售端个人中心
- [ ] 历史订单统计
- [ ] 个人业绩图表

**实现思路**:
```
📁 functions/api/sales/[token]/stats.js (NEW)
   - GET /api/sales/:token/stats
   - 返回: totalOrders, confirmedCount, monthlyTrend[]
   
📁 src/components/order/SalesStats.vue (NEW)
   - 显示个人统计数据
   
📁 src/OrderApp.vue
   - 在顶部添加"我的统计"入口
```

---

### 2.5 模板系统
- [ ] 管理端预设商品模板
- [ ] 销售下单时选择模板

**实现思路**:
```
📁 数据库扩展: templates 表
   CREATE TABLE templates (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     data TEXT, -- JSON: {name, size, color, material, ...}
     created_by TEXT,
     created_at INTEGER
   );
   
📁 functions/api/manage/templates/index.js (NEW)
   - CRUD 模板接口
   
📁 src/components/order/OrderForm.vue
   - 添加"选择模板"下拉框
   - 选中后填充表单字段
```

---

## 🔴 Phase 3: 复杂功能 (High Effort)

### 3.1 实时协作 (WebSocket)
- [ ] 多人同时查看订单实时同步
- [ ] 管理员操作实时推送

**实现思路**:
```
📁 functions/api/ws/orders.js (NEW - Durable Objects)
   - 使用 Cloudflare Durable Objects 实现 WebSocket
   - 订阅订单变更事件
   
📁 src/composables/useOrderSync.js (NEW)
   - 建立 WebSocket 连接
   - 监听 order.updated / order.status_changed 事件
   - 更新本地状态

注意: 需要 Cloudflare Workers Paid Plan
```

---

### 3.2 智能提醒系统
- [ ] 订单超时未处理提醒
- [ ] 临近到货日期预警

**实现思路**:
```
📁 functions/scheduled/order-reminder.js (NEW - Cron Trigger)
   - 每日定时任务检查超期订单
   - 调用邮件/企业微信 API 发送提醒
   
📁 wrangler.toml
   [triggers]
   crons = ["0 9 * * *"]  # 每天 9:00 执行
```

---

### 3.3 多级审批流程
- [ ] 可配置审批链路
- [ ] 区域经理/总部审批

**实现思路**:
```
📁 数据库扩展: approval_flows, approval_records 表

📁 functions/api/manage/approvals/index.js (NEW)
   - 审批流配置接口
   
📁 src/components/order/ApprovalFlow.vue (NEW)
   - 可视化审批流程图
   
注意: 需要角色权限系统支持
```

---

### 3.4 客户管理 (CRM-lite)
- [ ] 客户档案模块
- [ ] 关联订单到客户

**实现思路**:
```
📁 数据库扩展: customers 表
   CREATE TABLE customers (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     phone TEXT,
     company TEXT,
     address TEXT,
     created_at INTEGER
   );
   
📁 orders 表扩展: 添加 customer_id 字段

📁 src/views/Customers.vue (NEW)
   - 客户列表/详情页面
```

---

### 3.5 移动端 PWA
- [ ] 离线缓存支持
- [ ] 添加到主屏幕

**实现思路**:
```
📁 public/manifest.json (NEW)
   - 配置 PWA 元数据
   
📁 src/sw.js (NEW - Service Worker)
   - 缓存静态资源
   - 离线草稿存储 (IndexedDB)
   
📁 vite.config.js
   - 集成 vite-plugin-pwa
```

---

### 3.6 AI 辅助功能
- [ ] 图片自动识别商品类别
- [ ] 智能字段补全

**实现思路**:
```
📁 functions/api/ai/analyze.js (NEW)
   - 调用 Cloudflare Workers AI 或外部 API (GPT-4V)
   - 分析上传图片返回建议字段
   
📁 src/components/common/ImageUploader.vue
   - 上传后自动调用分析 API
   - 显示"AI 建议"按钮
```

---

## 📊 优先级矩阵

| 功能 | 复杂度 | 价值 | 推荐优先级 |
|------|--------|------|------------|
| 消息通知增强 | 🟢 | ⭐⭐⭐ | P0 |
| 表单"最近使用" | 🟢 | ⭐⭐⭐ | P0 |
| 数据导出 | 🟡 | ⭐⭐⭐ | P1 |
| 仪表盘统计 | 🟡 | ⭐⭐ | P1 |
| 批量操作 | 🟡 | ⭐⭐ | P2 |
| 模板系统 | 🟡 | ⭐⭐ | P2 |
| 实时协作 | 🔴 | ⭐ | P3 |

---

## 📝 开发日志

<!-- 在此记录开发进度 -->

| 日期 | 功能 | 状态 | 备注 |
|------|------|------|------|
| YYYY-MM-DD | 示例功能 | ✅ 完成 | PR #xxx |

