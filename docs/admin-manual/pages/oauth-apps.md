# OAuth 应用页面教程

- 页面路由：`/admin/oauth-apps`
- 典型权限：`admin:full`
- 默认导航：隐藏入口，适合管理员或集成维护人员使用

## 页面用途

OAuth 应用页用于管理第三方集成所需的 OAuth 客户端、授权范围和 token。

## 页面里可以做什么

- 注册 OAuth 应用
- 维护回调地址、授权类型和 scopes
- 重新生成 client secret
- 查看应用 token
- 撤销应用 token
- 删除不再使用的应用

## 推荐使用顺序

1. 先确认第三方系统需要的回调地址和 scopes。
2. 创建应用并保存首次返回的 secret。
3. 在测试环境完成授权码和 token 交换。
4. 上线后定期检查活跃 token，必要时撤销。

## 安全边界

- client secret 只应在创建或重生成时交付给集成方。
- 删除应用或撤销 token 会影响外部系统访问，操作前应先确认影响范围。
- `/api/manage/oauth/token` 有专用限流。

## 深入阅读

- [Management API](../../api/management.md)
- [部署环境变量](../../deployment/environment-variables.md)
