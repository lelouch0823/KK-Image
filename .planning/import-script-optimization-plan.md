# 导入脚本优化计划

## 目标
优化 `scripts/import-lali-direct.py` 脚本，提高数据映射质量和错误处理能力。

## 当前问题分析

### 1. 数据映射问题
- **价格处理**：`price` 和 `compare_at_price` 可能为 NULL，需要合理默认值
- **HTML 内容**：`description` 包含 HTML 标签，可能需要清理或保留
- **JSON 字段**：`extra`、`attributes` 等 JSON 字段需要验证格式
- **时间戳转换**：`scraped_at`、`published_at` 是 ISO 格式字符串，需要正确转换
- **URL 处理**：`url` 字段末尾有 `/`，影响 slug 生成
- **空值处理**：很多字段可能为空字符串或 NULL

### 2. 错误处理问题
- 缺少详细的错误日志
- 没有回滚机制
- 没有数据验证
- 没有进度报告
- 错误计数不准确

### 3. 代码结构问题
- 硬编码路径
- 缺少配置选项
- 缺少数据验证函数
- 缺少日志记录

## 优化方案

### 1. 重构代码结构
- 添加配置类（Config）
- 添加日志记录器（Logger）
- 添加数据验证器（Validator）
- 添加进度报告器（Progress）

### 2. 改进数据映射
- 添加字段类型转换函数
- 添加空值处理函数
- 添加 HTML 清理函数（可选）
- 添加 JSON 验证函数
- 添加时间戳解析函数

### 3. 增强错误处理
- 添加事务回滚机制
- 添加详细错误日志
- 添加数据验证
- 添加导入统计

### 4. 添加新功能
- 支持增量导入
- 支持数据验证模式
- 支持导入报告生成

## 实现步骤

### 步骤 1：创建配置类
```python
@dataclass
class Config:
    lali_db_path: str
    d1_db_path: str
    dry_run: bool = False
    batch_size: int = 1000
    log_file: str = None
    validate_only: bool = False
```

### 步骤 2：创建日志记录器
```python
class Logger:
    def __init__(self, log_file=None):
        self.log_file = log_file
        self.errors = []
        self.warnings = []
    
    def error(self, msg, context=None):
        ...
    
    def warning(self, msg, context=None):
        ...
    
    def info(self, msg):
        ...
```

### 步骤 3：创建数据验证器
```python
class Validator:
    def validate_product(self, data):
        ...
    
    def validate_variant(self, data):
        ...
    
    def validate_file(self, data):
        ...
```

### 步骤 4：改进映射函数
- 添加类型转换
- 添加空值处理
- 添加验证

### 步骤 5：添加事务管理
- 使用事务包装批量操作
- 添加回滚机制

### 步骤 6：添加进度报告
- 显示进度条
- 显示统计信息

### 步骤 7：添加导入报告
- 生成 JSON 报告
- 包含成功/失败统计
- 包含错误详情

## 验证方法
1. 运行 dry-run 模式验证映射
2. 检查生成的 SQL 语句
3. 验证导入后的数据完整性
4. 检查错误日志
