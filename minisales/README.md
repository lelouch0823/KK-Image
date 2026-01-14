# minisales - 销售端微信小程序

kk-life 销售端微信小程序，用于销售人员在手机端创建和管理订单。

## 技术栈
- **框架**: 微信小程序 (基础库 2.32+)
- **语言**: TypeScript
- **样式**: SCSS
- **渲染**: Skyline + glass-easel

## 快速开始

1. **安装依赖**
   ```bash
   npm install
   ```

2. **打开项目**
   - 使用微信开发者工具导入本目录
   - AppID 已在 `project.config.json` 配置

3. **配置 API 地址**
   编辑 `miniprogram/utils/constants.ts`:
   ```typescript
   export const API_BASE_URL = 'https://your-domain.pages.dev';
   ```

## 目录结构

```
miniprogram/
├── pages/
│   ├── index/      # 订单列表
│   ├── form/       # 创建订单
│   ├── detail/     # 订单详情
│   ├── stats/      # 业绩统计
│   └── login/      # 登录页
├── components/     # 公共组件
├── utils/
│   ├── api.ts      # 网络请求
│   ├── auth.ts     # 认证逻辑
│   └── constants.ts # 常量
└── assets/         # 图标
```

## 认证方式

1. **微信一键登录** - 已绑定微信的用户可直接登录
2. **密码登录** - 使用管理员分配的 access_token + 密码登录
3. **绑定微信** - 密码登录后可绑定微信，方便后续一键登录

## 发布

1. 在微信开发者工具点击 **上传**
2. 登录 [微信公众平台](https://mp.weixin.qq.com) 提交审核

## 文档

详细开发文档请参阅: [docs/developer-guide/minisales.md](../docs/developer-guide/minisales.md)
