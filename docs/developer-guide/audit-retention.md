# 审计保留与归档

本文档定义统一操作审计的保留分层、维护命令和归档建议。

## 保留原则

- 默认优先保留结构化字段，避免依赖原始 payload
- 高风险、高严重级别事件保留更久
- 删除或归档前必须确认已满足合规与排查需求

## 保留分层

### `critical`

建议保留：

- 365 天以上

典型事件：

- 权限模型修改
- 备份创建/删除
- 订单或资源的高风险删除
- 审计导出

### `high`

建议保留：

- 180 天以上

典型事件：

- 核心业务写操作
- 批量变更
- 失败写操作
- 权限拒绝

### `normal`

建议保留：

- 90 天以上

典型事件：

- 普通创建/更新
- 低风险业务辅助动作

## 运维命令建议

### 统计各等级保留量

```sql
SELECT severity, COUNT(*) AS total
FROM audit_logs
GROUP BY severity;
```

### 统计按域分布

```sql
SELECT domain, COUNT(*) AS total
FROM audit_logs
GROUP BY domain
ORDER BY total DESC;
```

### 清理过期低风险日志前的预检查

```sql
SELECT COUNT(*) AS total
FROM audit_logs
WHERE severity = 'normal'
  AND created_at < ?;
```

## 归档建议

建议流程：

1. 先按时间和等级筛选候选数据
2. 先导出归档副本，再执行删除
3. 归档文件使用只读存储，保留校验信息
4. 在变更记录中登记归档时间窗和执行人

## 注意事项

- 不要直接删除 `critical` 审计而不做归档
- 导出文件应走受控存储，不应散落在个人机器
- 任何批量清理都应先在预发或备份数据上验证
