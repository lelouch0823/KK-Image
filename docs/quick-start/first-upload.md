# 首次验证指南

这个文件保留原来的路径名，但当前目标已经不是“公开匿名图床首次上传”，而是验证 kk-life 的核心管理与业务链路是否可用。

## 本轮建议验证的能力

- 登录页可访问
- 管理端可登录
- 管理端文件上传可用
- 销售端可登录并创建订单
- 共享空间可访问

## 1. 验证登录入口

打开以下地址：

- `https://your-domain.pages.dev/login`
- `https://your-domain.pages.dev/admin`

预期：

- 根路径 `/` 会重定向到 `/login`
- 可以使用 `BASIC_USER` / `BASIC_PASS` 登录并进入管理端

## 2. 验证管理端文件上传

1. 进入 `/admin/files`
2. 上传一个测试文件
3. 确认文件出现在列表中
4. 从界面复制链接并验证可以访问

若上传失败，优先检查：

- `DB` 是否已绑定
- `R2_BUCKET` 是否已绑定
- 数据库迁移是否已执行

## 3. 验证销售端链路

1. 在管理端创建一个销售员账号
2. 记录返回的 `accessToken`
3. 打开 `/sales/<accessToken>`
4. 使用密码完成登录
5. 创建一个测试订单，并上传至少一个附件

预期：

- 销售端可成功登录
- 订单创建成功
- 订单详情中可看到附件和时间轴

## 4. 验证共享空间

1. 在管理端创建共享空间
2. 关联文件或商品素材
3. 复制分享链接
4. 打开 `/space/:token`

若空间设置了密码：

- 首次 `GET` 会返回需要密码
- 使用前端页面或 `POST /api/space/:token` 提交密码后获取完整内容

## 5. 推荐的本地全链验证

```bash
pnpm test
pnpm build
pnpm start
pnpm test:real-api:full-chain
```

如果你要在本地补一轮高保真黑盒 Worker / HTTP 验收，请使用：

```bash
pnpm test
pnpm build
pnpm start
pnpm test:real-api:blackbox
```

说明：

- `pnpm test` 先验证默认仓库测试套件。
- `pnpm test:real-api` / `pnpm test:real-api:fast` 偏向快速业务回归，不等于最高保真的本地 HTTP 验收。
- `pnpm test:real-api:blackbox` 与 `pnpm test:real-api:full-chain:blackbox` 更接近本地真实 Worker / HTTP 形态。
- real API 测试前要保证本地 Worker 已启动且 `http://127.0.0.1:8080/api/v1/health` 正常。

## 6. 常见问题

### 登录页打不开

- 确认 Pages 部署已完成
- 确认前端资源已正确构建到 `dist`

### 管理端登录失败

- 检查 `BASIC_USER` / `BASIC_PASS`
- 检查 `JWT_SECRET`

### 上传失败

- 检查 `DB` 与 `R2_BUCKET` 绑定
- 检查远程或本地迁移是否已经执行
- 若使用 Telegram / S3 存储，检查对应可选环境变量是否已配置

### real API 测试直接失败

- 检查 `127.0.0.1:8080` 是否被旧 `workerd` / `wrangler pages dev` 残留进程占用
- 检查 `pnpm build` 是否成功
- 检查 `pnpm start` 启动后的 `/api/v1/health`

### 销售端无法登录

- 确认访问的是 `/sales/:token`
- 确认销售员账号已启用
- 若使用微信登录，确认 `WECHAT_APPID` / `WECHAT_SECRET` 已配置

## 7. 继续阅读

- [API 文档](../api/README.md)
- [用户手册](../user-manual/README.md)
- [管理员手册](../admin-manual/README.md)
