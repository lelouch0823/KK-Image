# 销售人员管理 (Sales Management)

管理员可以通过 API 或后台管理销售人员账号。

## 1. 销售人员列表
当前已支持管理端界面和 API 双通道管理。

### 获取销售列表
`GET /api/manage/salespersons`

## 2. 账号创建
管理员需为每个销售人员分配独立的 Access Token。

### 创建销售员
`POST /api/manage/salespersons`
```json
{
  "name": "张三",
  "store": "旗舰店",
  "password": "initial_password"
}
```

响应会包含生成的 `access_token`，请妥善保存并发给销售员。

## 2.1 重置 Access Token

当前系统已经支持直接通过管理接口重置：

`POST /api/manage/salespersons/:id/reset-token`

返回值会包含新的：

- `accessToken`

适用场景：

- 销售员链接泄露
- 销售员离岗后重新分配
- 怀疑 token 被误转发或误公开

## 3. 微信绑定
为了方便销售在小程序端登录，推荐绑定微信账号。

**绑定流程**:
1. 销售员使用 `access_token` + `password` 登录小程序。
2. 在小程序个人中心点击"绑定微信"。
3. 系统将调用 `POST /api/sales/:token/bind-wechat` 完成绑定。

绑定成功后，销售员即可通过“微信一键登录”快速进入系统，无需每次输入密码。

---

**注意**:
- Access Token 是销售员的唯一身份标识，泄露后请及时重置。
- 重置后，旧 token 应视为立即失效，不再继续分发或使用。
