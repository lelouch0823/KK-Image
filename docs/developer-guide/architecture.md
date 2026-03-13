# 系统架构设计 (Architecture)

## 1. 总体架构

kk-life 采用 **Serverless 边缘架构**，完全基于 Cloudflare 生态构建。

```mermaid
graph TD
    User[用户/客户端] --> CDN[Cloudflare Network]
    
    subgraph Cloudflare Pages
        Static[静态资源 (Vue 3)]
        Functions[后端 Functions (Node.js)]
    end
    
    CDN --> Static
    CDN --> Functions
    
    Functions --> D1[(D1 Database)]
    Functions --> R2[(R2 Storage)]
    Functions --> KV[(KV Cache)]
    
    D1 --> Meta[元数据/订单/空间]
    R2 --> Blob[图片/视频 Blob]
    KV --> Config[系统配置]
```

## 2. 核心技术决策

### 2.1 数据库选型：D1 (SQLite)
- **原因**: 相比 KV，D1 提供关系型查询能力，适合处理订单 JOIN、复杂筛选和事务。
- **用法**: 存储所有业务实体 (Orders, Customers, Spaces, Files Metadata)。
- **SOTA 特性**: 使用 `Generated Columns` (虽然目前移除，但保留架构兼容) 和 `Batch API` 优化批量写入。

### 2.2 存储架构：CAS (Content Addressable Storage)
- **去重机制**: 
    - `files` 表：存储用户可见的文件名和元数据。
    - `blobs` 表：存储物理文件的哈希索引 (`content_hash`)。
    - 物理文件：存储在 R2，Key 为 `SHA-256` 哈希值。
- **优势**: 
    - 秒传功能 (Instant Upload)
    - 极大节省存储空间 (相同文件只存一份)

### 2.3 权限模型
- **Admin**: 基于 Basic Auth 或 JWT，完全控制。
- **Sales**: 基于 Access Token (`/api/sales/:token`)，受限访问。
- **Guest**: 基于 Share Token (`/space/:token`) + Password，只读访问。

### 2.4 统一操作审计
- **统一底座**: 高风险写操作落入统一 `audit_logs` 模型，而不是各模块各自维护零散日志。
- **服务端优先**: success / denied / failed 事件由后端统一生成。
- **Phase 2 工程化**: 高风险写路由通过路由审计声明建模，并由自动抽取脚本校验覆盖一致性。

## 3. 目录结构规范

```bash
functions/
├── api/
│   ├── manage/    # 需要 Admin 权限
│   ├── sales/     # 需要 Sales Token
│   └── space/     # 公开/密码访问
├── lib/
│   ├── db.js      # D1 连接工具
│   └── auth.js    # JWT/Basic 认证逻辑
└── storage/
    └── router.js  # 智能存储路由
```

## 4. 前端架构 (Vue 3 + Tailwind v4)

- **Composables**: 业务逻辑复用 (自研 Hooks)。
- **Tailwind v4**: 无需 `postcss.config.js`，基于 Vite 插件的即时编译。
- **Icon System**: 纯 SVG (Heroicons)，无字体文件加载延迟。
