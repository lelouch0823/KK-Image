# Wrangler 开发指南 (v3.x+)

**Last Updated**: 2025-12-28
**Scope**: 适用于 kk-image 项目的开发与部署。

Wrangler 是 Cloudflare Workers/Pages 的官方命令行工具。本项目使用 Wrangler v3+ 进行本地开发、数据库管理和部署。

## 1. 安装与初始化

确保已安装 Node.js 18+。

```bash
# 全局安装 (可选)
npm install -g wrangler

# 登录 Cloudflare 账号
wrangler login

# 验证登录状态
wrangler whoami
```

---

## 2. 常用命令 (Cheat Sheet)

### 🚀 开发与部署

| 命令 | 说明 |
|------|------|
| `npm run dev` | **推荐**。启动本地开发服务器 (Pages 模式)。模拟 Workers, D1, R2, KV 环境。 |
| `npx wrangler pages dev dist` | 手动启动 Pages 本地预览 (需先执行 `npm run build`)。 |
| `npm run deploy` | **推荐**。自动构建并部署到 Cloudflare Pages 生产环境。 |
| `npx wrangler pages deploy dist` | 手动部署 `dist` 目录到生产环境。 |

### 💾 数据库管理 (D1)

本项目使用 `kk-image-db`。

| 场景 | 命令 |
|------|------|
| **本地**：查看表结构 | `npx wrangler d1 execute kk-image-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"` |
| **本地**：执行 SQL 文件 | `npx wrangler d1 execute kk-image-db --local --file=./migrations/xxxx.sql` |
| **远程**：执行 SQL 文件 | `npx wrangler d1 execute kk-image-db --remote --file=./migrations/xxxx.sql` |
| **远程**：查看数据 (Admin) | `npx wrangler d1 execute kk-image-db --remote --command="SELECT * FROM spaces LIMIT 5;"` |

> **注意**: `--local` 标志用于操作本地 `.wrangler/` 目录下的模拟数据库；`--remote` 用于直接操作真实的 Cloudflare D1 生产数据库。

### 📦 对象存储 (R2)

| 命令 | 说明 |
|------|------|
| `npx wrangler r2 bucket list` | 列出所有 R2 存储桶 |
| `npx wrangler r2 key list` | (慎用) 调试时查看 R2 键 |

---

## 3. 配置文件 (`wrangler.toml`)

虽然 Pages 项目主要通过 Dashboard 配置，但 Wrangler v3 支持通过 `wrangler.toml` 配置本地开发环境绑定。

```toml
# 示例 wrangler.toml (Project Root)
name = "kk-image"
pages_build_output_dir = "dist"

# 本地开发绑定模拟
[[d1_databases]]
binding = "DB"
database_name = "kk-image-db"
database_id = "xxxx-xxxx-xxxx" # 本地开发时此 ID 仅作标识，不需要真实匹配

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "kk-image-storage"

[[kv_namespaces]]
binding = "KV"
id = "xxxx"
```

## 4. 本地开发最佳实践

1.  **始终使用 `npm run dev`**: 这不仅会启动 Vite 前端服务器，还会启动 Wrangler Pages 代理，确保 `functions/` 目录下的后端代码能正确访问本地模拟的 D1 和 R2。
2.  **数据持久化**: 本地模拟数据默认存储在 `.wrangler/state/v3/` 目录下。如果需要重置本地数据，可以删除该目录。
3.  **Secrets 管理**: 本地开发时，在项目根目录创建 `.dev.vars` 文件来存储敏感环境变量 (如 `TG_Bot_Token`)。不要将其提交到 Git。

```env
# .dev.vars 示例
TG_Bot_Token="123456:ABC-def"
BASIC_USER="admin"
BASIC_PASS="password"
```

## 5. 常见问题

*   **Q: 本地 D1 数据和线上不一致？**
    *   A: 本地和远程是完全隔离的数据库。本地使用 `.wrangler` 下的 SQLite 文件，远程使用 Cloudflare 基础设施。
*   **Q: 部署失败，提示找不到 D1/R2？**
    *   A: 请确保在 Cloudflare Dashboard -> Pages -> Settings -> Functions 中正确绑定了 D1 和 R2 资源，且变量名 (`DB`, `R2_BUCKET`) 与代码一致。
