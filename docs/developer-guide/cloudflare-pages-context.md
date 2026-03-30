# Cloudflare + Hono Context 传递最佳实践

> 当前项目默认使用 Hono Context，不再以裸 Pages Functions `context.data` 作为主业务模式。

## 1. 当前项目的正确做法

在 kk-life 里，请优先使用 Hono 的上下文传值接口：

- `c.set('user', user)`
- `c.get('user')`

这是当前路由、中间件和权限链的标准写法。

## 2. 常见错误

### 2.1 不要直接给 Hono Context 挂属性

```javascript
// Middleware
c.user = user; // ❌ 不推荐

// Handler
const user = c.user; // ❌ 不稳定，也不符合当前项目约定
```

### 2.2 不要把旧 Pages Functions 示例当成默认模式

旧文档中常见的：

- `context.data.user = user`
- `functions/_middleware.js`
- `functions/api/endpoint.js`

这些写法属于裸 Pages Functions 时代的参考，不是当前项目主路径。

## 3. 当前推荐模式

### 中间件

```javascript
app.use('/api/manage/*', async (c, next) => {
  const user = await authenticate(c);
  c.set('user', user);
  await next();
});
```

### 路由处理器

```javascript
app.get('/api/manage/orders', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  return c.json({ success: true, data: [] });
});
```

## 4. 如果真的在写裸 Pages Function

只有在极少数未接入 Hono 的处理器里，才考虑使用 `context.data` 传递链路内数据。

但在当前代码库里，订单、采购、商品、通知、审计等核心业务都应默认走 Hono 上下文，不要再新开一套 `context.data` 风格。

## 5. 相关说明

- Hono 总入口：`functions/lib/hono/app.js`
- 中间件目录：`functions/lib/hono/middleware/`
- 路由目录：`functions/lib/hono/routes/`
