# Space API

> Base URL: `/api/space/:token`

当前公开分享能力有两条主线：

- 空间：`GET /api/space/:token`、`POST /api/space/:token`
- 相册：`GET /api/gallery/:token`、`POST /api/gallery/:token`

本页先记录空间 API：

## 1. 获取空间详情

`GET /api/space/:token`

行为：

- 若空间不存在，返回 `404`
- 若空间未公开且不是管理员预览，返回 `403`
- 若空间已过期，返回 `410`
- 若空间设置了密码，返回 `401`，并在响应中提示 `requiresPassword`

返回数据通常包含：

- `name`
- `description`
- `template`
- `templateData`
- `coverImage`
- `fileCount`
- `viewCount`
- `files`
- `groupedFiles`
- `subspaces`

示例：

```json
{
  "success": true,
  "data": {
    "name": "2026 春季样册",
    "template": "portfolio",
    "fileCount": 8,
    "files": [],
    "subspaces": []
  }
}
```

## 2. 密码校验并获取内容

`POST /api/space/:token`

Body:

```json
{
  "password": "your-space-password"
}
```

说明：

- 当前密码不是通过 `x-space-password` header 提交
- 成功后直接返回完整空间数据

## 3. 说明

- 旧文档里出现过的 `/api/space/:token/folder/:folderId` 与 `/api/space/:token/download/:fileId` 在当前实现中不存在
- 公开相册使用的是独立文件式入口 `/api/gallery/:token`
- 公开空间页面前端路由是 `/space/:token`
- 如果管理员携带有效认证上下文，请求可进入未公开空间的预览模式
