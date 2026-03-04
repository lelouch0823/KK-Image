# OPA/Rego Authz Verification (2026-03-04)

## 状态

- 状态: Completed
- 目标: 管理端权限判定与 OPA 决策严格一致，去除冗余未受保护入口

## 本轮收敛范围

- 为以下管理路由补齐或细化 `requirePermission(...)`：
  - `dashboard` -> `stats:read`
  - `notifications` -> `read` / `write`
  - `goods-overview` -> `products:manage`
  - `purchase-orders` -> `products:manage`
  - `customers` -> `orders:manage`
  - `salespersons` -> `users:read` + 写操作 `users:write`
  - `settings` -> `admin:full`
  - `utils` -> `files:write`
  - `ai` -> `stats:read`
  - `user` -> `read`
  - `products/index`、`products/[id]` -> `products:manage`
- 新增回归测试：`functions/lib/hono/routes/manage/__tests__/core-authz-gates.test.js`

## 验证证据

- `npm run test:unit` -> PASS (exit 0)
- `npm run authz:policy:test` -> PASS (4/4)
- `npm run db:migrations:check-prefix` -> PASS

## 冗余与暴露面复查

- 路由扫描脚本结果仅剩：
  - `manage/orders/list.js`
  - `manage/products/export.js`
  - `manage/products/batch.js`
- 上述 3 个文件已由父级路由统一权限门禁覆盖：
  - `manage/orders/index.js` -> `orders:manage`
  - `manage/products/index.js` -> `products:manage`

## 结论

- 当前管理端核心路由已完成 OPA 对齐与冗余权限入口收敛。
- 无新增仓库外运行时依赖；OPA 仅作为策略测试/构建工具链依赖，运行时使用仓库内产物与适配层。
