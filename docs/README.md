# kk-life 文档中心

这里汇总当前仍应被依赖的现行文档。历史计划、评审与归档材料不在本页列为“当前指南”。

## 快速入口

- [项目摘要](project-summary.md)
- [快速开始](quick-start/README.md)
- [部署指南](deployment/README.md)
- [API 文档](api/README.md)
- [开发者指南](developer-guide/README.md)
- [架构文档](architecture/README.md)

## 用户侧文档

- [用户手册](user-manual/README.md)
- [管理员手册](admin-manual/README.md)
- [销售端使用手册（移动端 Web）](user-manual/sales-guide.md)
- [微信小程序销售端手册](user-manual/minisales-guide.md)

## 核心技术文档

- [数据库结构](DATABASE_SCHEMA.md)
- [API 总览](API_REFERENCE.md)
- [授权策略系统（OPA / Rego）](developer-guide/authz-policy-system.md)
- [前端请求内核](architecture/frontend-request-core.md)
- [商品与需求投影刷新模型](architecture/projection-refresh-model.md)
- [后端性能基线](architecture/backend-performance-baseline.md)
- [后端性能优化审查](architecture/backend-performance-optimization-review.md)
- [后端性能优化实施计划](architecture/backend-performance-optimization-plan.md)

## 当前产品入口

- 管理端：`/admin`
- 登录页：`/login`
- 销售端：`/sales/:token`
- 共享空间：`/space/:token`
- 相册分享：`/gallery/:token`

## 本地联调建议

```bash
pnpm dev:all
pnpm test
pnpm test:real-api:fast
```

## 说明

- 根路径 `/` 默认重定向到 `/login`。
- 当前 Web 前端是 Vue 3 + Vite；不要把管理端 shell 描述成 Flutter 或移动端 app shell。
- 管理端 feature 的路由、权限、侧边栏、命令面板和最近访问映射以 `src/config/admin-features.ts` 为 source of truth；新增后台页面时先改 manifest，再让 router/sidebar/command/recent-view 消费 helper。
- 当前默认对象存储为 R2；Telegram / S3 存储属于可选配置。
- 当前后端是“`functions/lib/hono/app.js` 挂载的 Hono 主业务路由 + 少量文件式 public/cron 路由”并存，不要把仓库描述成纯文件式 Functions，也不要误写成所有接口都已迁入 Hono。
- `pnpm test` 是默认仓库测试套件；real API profile 都以 `REAL_API_BASE_URL` 指向的 Worker 为主，`fast` 只是较快 smoke 口径，部分销售链路会使用 direct in-process transport；`*:blackbox` profile 会禁用 direct 口径并按文件隔离，更适合高保真 HTTP 验收。
- 历史计划、评审与大部分 agent 过程正文已下沉到 `docs/archive/plans/`、`docs/archive/reviews/`、`docs/archive/superpowers/`；`docs/plans`、`docs/reviews` 只保留索引说明，`docs/superpowers` 如仍有少量计划 / 规格正文，也只代表当次任务上下文，不是当前产品或工程规范的 source of truth。
