# 贡献指南

本指南只保留当前仓库可直接执行的贡献流程，不再引用仓库中不存在的子文档。

## 1. 开发环境

- Node.js 20+
- `pnpm`
- Cloudflare 账户（如需验证部署或 D1 / R2）

## 2. 本地启动

```bash
corepack enable
pnpm install
pnpm dev:all
```

如果只需要前端开发：

```bash
pnpm dev
```

## 3. 常用检查

```bash
pnpm lint
pnpm test:unit
pnpm test:real-api:full-chain
```

## 4. 数据库相关

```bash
pnpm db:migrate:local
```

如需远程迁移：

```bash
pnpm db:migrate:preview:raw
pnpm db:migrate:prod:raw
```

## 5. 提交流程建议

1. 基于最新主分支创建工作分支
2. 修改代码或文档
3. 运行与改动相匹配的校验命令
4. 提交前确认文档、接口示例和脚本名称与当前代码一致

## 6. 文档变更要求

- 不要继续使用旧版图床 / Telegraph 叙述覆盖当前产品入口
- 不要新增失效链接
- 命令、路由、绑定名必须以仓库当前代码与 `wrangler.toml` 为准

## 7. 问题反馈

请在当前仓库对应的 Issues / Pull Requests 中提交问题、修复和文档建议。
