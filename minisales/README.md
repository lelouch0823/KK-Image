# minisales

销售端微信小程序，负责销售登录、订单列表、下单、详情跟进、业绩统计和共享空间浏览。

## 技术栈

- 微信小程序 + TypeScript
- SCSS
- TDesign Mini Program
- Skyline + glass-easel
- Vitest 单测

## 快速开始

```bash
cd minisales
npm install
```

使用微信开发者工具导入 `minisales/` 目录。开发环境接口地址默认在 [miniprogram/utils/constants.ts](./miniprogram/utils/constants.ts) 中配置。

## 当前页面架构

```text
miniprogram/pages/
├── login/         登录与微信绑定
├── index/         销售订单列表 + 通知抽屉
├── form/          新建订单 + 商品绑定 + 上传
├── detail/        订单详情 + 留言 + 复制预填
├── stats/         业绩统计 + 微信绑定入口
├── spaces/        共享空间列表
└── spaces_detail/ 共享空间详情
```

页面实现遵循同一套分层：

- `services/sales/*`: 新后端接口访问与响应归一化
- `utils/normalize/*`: 纯数据整形
- `pages/*/controller.ts`: 页面 view-model 和纯逻辑
- `components/sales/*`: 页面级复用 UI 组件

## 常用命令

```bash
npm run test:unit
npm run typecheck
```

常见定向验证：

```bash
npm run test:unit -- tests/unit/pages/order-detail-controller.test.ts
npm run test:unit -- tests/unit/pages/sales-stats-controller.test.ts tests/unit/pages/spaces-controller.test.ts
```

## 认证说明

- `wechat` 登录：已绑定微信的销售可直接登录
- `password` 登录：通过销售链接或账号密码登录
- 密码登录后，可在登录页或统计页触发微信绑定

## 更多文档

详见 [docs/developer-guide/minisales.md](../docs/developer-guide/minisales.md)。
