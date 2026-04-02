# 销售端微信小程序（minisales）

> 目录：`minisales/`

本文档说明当前仓库中微信小程序端的实际结构、登录方式与开发方法。

## 1. 当前技术栈

- 微信小程序
- TypeScript
- SCSS
- TDesign Mini Program
- Skyline + glass-easel

## 2. 当前页面结构

根据 `miniprogram/app.json`，当前主要页面为：

- `pages/index/index`：订单列表
- `pages/spaces/spaces`：资源 / 空间列表
- `pages/stats/stats`：销售统计
- `pages/login/login`：登录页
- `pages/form/form`：创建订单
- `pages/detail/detail`：订单详情
- `pages/spaces_detail/detail`：空间详情

## 3. 登录方式

当前小程序已实现：

- 用户名 / 手机号 + 密码登录
- 微信一键登录（后端已配置时）
- 微信绑定接口

对应后端接口：

- `POST /api/sales/login`
- `POST /api/sales/wechat-login`
- `POST /api/sales/:token/auth`
- `POST /api/sales/:token/bind-wechat`

## 4. 本地开发

```bash
cd minisales
npm install
```

然后用微信开发者工具打开 `minisales/` 目录。

## 5. API 地址

小程序通过 `miniprogram/utils/constants.ts` 中的 `API_BASE_URL` 指向后端域名。

部署前应确认：

- 后端域名已加入小程序合法域名
- `/api/sales/*` 路由可访问

## 6. 当前业务能力

- 登录与会话恢复
- 订单列表、详情、创建
- 文件上传
- 销售统计
- 空间列表与详情

## 7. 说明

- 当前小程序登录页默认直接展示用户名 / 密码表单
- “微信一键登录”是否可用取决于后端 `WECHAT_APPID` / `WECHAT_SECRET`
- 若要排查后端接口，请同时参考 [docs/api/sales.md](../api/sales.md)
