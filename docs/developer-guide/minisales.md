# 销售端微信小程序 (minisales)

> 目录: `minisales/`
> 目标: 对齐当前 web 销售端的接口契约、页面层级和核心业务流程

## 1. 架构分层

`minisales/miniprogram/` 现在按下面的责任切分：

- `services/http/request.ts`
  统一 Bearer token、错误结构和 401 跳转
- `services/auth/session.ts`
  会话恢复、登录方式持久化、缺 token 处理
- `services/sales/*.ts`
  销售域 API 封装，返回稳定结构
- `utils/normalize/*.ts`
  纯归一化逻辑，兼容 snake_case / camelCase / JSON string
- `pages/*/controller.ts`
  纯 view-model 组装与页面逻辑辅助
- `components/sales/*`
  订单卡片、通知抽屉、商品绑定、详情摘要、统计指标等复用组件

这意味着页面文件主要负责：

- 调 service
- 维护 loading / error / ready 状态
- 调 controller 产出视图模型
- 处理导航、留言、预览、绑定微信等交互

## 2. 页面地图

```text
miniprogram/pages/
├── login/         登录、微信登录、密码登录后绑定微信
├── index/         订单列表、搜索、下拉刷新、分页、通知抽屉
├── form/          新建订单、商品绑定、素材上传、重复下单预填
├── detail/        订单摘要、行项目进度、素材、时间线、留言、复制
├── stats/         KPI、30 天趋势、密码登录用户的绑定微信入口
├── spaces/        共享空间卡片列表
└── spaces_detail/ 模板感知的共享空间详情
```

说明：

- `stats` 是从 shell 进入的二级页面，不是底部第三个 tab
- `spaces` 改成确定性卡片流，不再使用随机瀑布高宽比
- `detail` 和 `form` 已经可以通过 duplicate prefill 共享商品、数量、附件和绑定信息

## 3. 认证与会话

支持两条登录链路：

1. `wechat-login`
   已绑定微信时直接换取销售 JWT
2. `password login`
   通过销售链接内 access token 或账号密码登录，再可选绑定微信

本地会话关键状态：

- `KEYS.USER`
- `KEYS.TOKEN`
- `KEYS.LOGIN_METHOD`
- `KEYS.AUTH_CONFIG`

其中 `AUTH_CONFIG` 还保存了微信登录开关和本地 session 内的微信绑定完成态，`stats` 页面会据此隐藏已成功绑定后的按钮。

## 4. 主要接口映射

| 场景 | 接口 |
| --- | --- |
| 微信登录 | `POST /api/sales/wechat-login` |
| 密码登录 | `POST /api/sales/:token/auth` |
| 获取当前销售信息 | `GET /api/sales/:token/auth` |
| 绑定微信 | `POST /api/sales/:token/bind-wechat` |
| 订单列表 | `GET /api/sales/:token/orders` |
| 创建订单 | `POST /api/sales/:token/orders` |
| 订单详情 | `GET /api/sales/:token/orders/:id` |
| 标记详情已读 | `PATCH /api/sales/:token/orders/:id/read` |
| 订单留言 | `POST /api/sales/:token/orders/:id/comment` |
| 上传素材 | `POST /api/sales/:token/upload` |
| 业绩统计 | `GET /api/sales/:token/stats` |
| 共享空间列表 | `GET /api/sales/:token/spaces` |
| 共享空间详情 | `GET /api/sales/:token/spaces/:id` |

## 5. 测试与验证

安装依赖：

```bash
cd minisales
npm install
```

核心验证命令：

```bash
npm run test:unit
npm run typecheck
```

定向回归：

```bash
npm run test:unit -- tests/unit/pages/order-detail-controller.test.ts
npm run test:unit -- tests/unit/pages/sales-stats-controller.test.ts tests/unit/pages/spaces-controller.test.ts
```

当前单测覆盖重点：

- request / auth / services 契约
- normalize 兼容层
- order list / form / detail controller
- stats / spaces controller
- session guard

## 6. 手工回归建议

在微信开发者工具里至少验证以下链路：

1. 登录与 session restore
2. 密码登录后进入统计页触发微信绑定
3. 订单列表搜索、下拉刷新、分页和通知跳详情
4. 商品绑定下单、手动下单、图片上传
5. 订单详情留言、已读、复制到表单
6. 共享空间列表进入详情并预览素材

## 7. 配置说明

开发接口地址在 [miniprogram/utils/constants.ts](../../minisales/miniprogram/utils/constants.ts)：

```ts
export const API_BASE_URL = 'http://127.0.0.1:8080';
```

若切换环境，需要同步配置微信公众平台的 request / upload 合法域名。
