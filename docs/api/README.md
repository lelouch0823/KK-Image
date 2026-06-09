# kk-life API 文档

当前仓库主要暴露四组 API：

1. 管理端 API：`/api/manage/*`
2. 销售端 API：`/api/sales/*`
3. 公开分享 API：`/api/space/*` + `/api/gallery/*`
4. 标准资源 / 运维 API：`/api/v1/*`

## 管理端 API

- Base URL: `/api/manage`
- 认证：Admin JWT、Basic Auth、`X-API-Key`
- 主要能力：
  - 仪表盘、订单、客户、销售员
  - 文件上传、共享空间、商品与采购
  - 审计日志、Webhook、Outbox、Replay

详见 [management.md](management.md)。

## 销售端 API

- Base URL: `/api/sales`
- 认证：
  - 公共登录接口：无需 JWT
  - 业务接口：`/api/sales/:token/*` + Sales JWT

详见 [sales.md](sales.md)。

## 公开分享 API

- Base URL: `/api/space/:token`
- 认证：share token，必要时再通过 `POST` 提交密码
- 当前实现只保留 `GET /api/space/:token` 与 `POST /api/space/:token`

另有公开相册：

- Base URL: `/api/gallery/:token`
- 当前实现保留 `GET /api/gallery/:token` 与 `POST /api/gallery/:token`

详见 [space.md](space.md)。

## 标准资源 / 运维 API

主要包括：

- `/api/v1/auth`
- `/api/v1/files`
- `/api/v1/folders`
- `/api/v1/users`
- `/api/v1/permissions`
- `/api/v1/webhooks`
- `/api/v1/health`
- `/api/v1/health/info`
- `/api/v1/api-docs`

## 响应约定

常见成功响应：

```json
{
  "success": true,
  "data": {}
}
```

常见失败响应：

```json
{
  "success": false,
  "error": "错误描述",
  "code": "ERROR_CODE"
}
```

## 说明

- 关键业务写入后的通知、缓存失效、Webhook 与补充审计已切换到 durable outbox 异步处理。
- 客户端应以主请求返回值和后续读模型刷新为准，不应依赖副作用同步完成。
- 旧的 `docs/api-docs/*` 路径已废弃；当前有效入口就是本目录。
