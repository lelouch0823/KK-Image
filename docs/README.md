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

## 当前产品入口

- 管理端：`/admin`
- 登录页：`/login`
- 销售端：`/sales/:token`
- 共享空间：`/space/:token`
- 相册分享：`/gallery/:token`

## 本地联调建议

```bash
pnpm dev:all
pnpm test:real-api:full-chain
```

## 说明

- 根路径 `/` 默认重定向到 `/login`。
- 当前默认对象存储为 R2；Telegram / S3 存储属于可选配置。
- `docs/plans`、`docs/archive`、`docs/reviews`、`docs/superpowers` 主要用于保留历史过程材料。
