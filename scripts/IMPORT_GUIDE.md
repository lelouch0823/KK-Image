# 数据导入框架使用指南

## 概述

本框架支持将不同结构的数据库导入到目标数据库，特别处理了以下复杂情况：

1. **字段名不同** - 源表和目标表的字段名不一致
2. **图片字段格式不同** - 单个URL、数组、JSON、逗号分隔等
3. **值类型不同** - 布尔值、整数、字符串、JSON等
4. **外键关联** - 需要转换为UUID格式

---

## 一、字段名映射

### 基本映射

当源字段名和目标字段名不同时，使用 `field_mappings`：

```json
{
  "field_mappings": {
    "id": "product_id",           // 目标字段 "id" ← 源字段 "product_id"
    "name": "title",              // 目标字段 "name" ← 源字段 "title"
    "spu": "sku",                 // 目标字段 "spu" ← 源字段 "sku"
    "category": "product_type"    // 目标字段 "category" ← 源字段 "product_type"
  }
}
```

### 常量值

当目标字段需要固定值时，使用 `$` 前缀：

```json
{
  "field_mappings": {
    "currency": "$CNY",           // 固定值 "CNY"
    "status": "$active",          // 固定值 "active"
    "is_public": "$1",            // 固定值 1
    "series": "$null",            // NULL 值
    "images": "$[]",              // 空数组 "[]"
    "options": "${}"              // 空对象 "{}"
  }
}
```

---

## 二、图片字段处理

### 场景 1：单个图片URL

**源数据：**
```json
{
  "image": "https://example.com/image.jpg"
}
```

**配置：**
```json
{
  "field_mappings": {
    "images": "image"
  },
  "field_transformations": {
    "images": {
      "type": "wrap_to_array"
    }
  }
}
```

**结果：**
```json
{
  "images": "[\"https://example.com/image.jpg\"]"
}
```

### 场景 2：多个图片URL（数组）

**源数据：**
```json
{
  "images": ["https://example.com/1.jpg", "https://example.com/2.jpg"]
}
```

**配置：**
```json
{
  "field_mappings": {
    "images": "images"
  },
  "field_transformations": {
    "images": {
      "type": "json_array"
    }
  }
}
```

### 场景 3：JSON字符串格式的数组

**源数据：**
```json
{
  "images": "[\"https://example.com/1.jpg\", \"https://example.com/2.jpg\"]"
}
```

**配置：**
```json
{
  "field_mappings": {
    "images": "images"
  },
  "field_transformations": {
    "images": {
      "type": "json_parse_or_keep"
    }
  }
}
```

### 场景 4：逗号分隔的URL

**源数据：**
```json
{
  "images": "https://example.com/1.jpg,https://example.com/2.jpg"
}
```

**配置：**
```json
{
  "field_mappings": {
    "images": "images"
  },
  "field_transformations": {
    "images": {
      "type": "split_to_array",
      "separator": ",",
      "trim": true,
      "filter_empty": true
    }
  }
}
```

### 场景 5：图片对象（主图+缩略图）

**源数据：**
```json
{
  "images": {
    "main": "https://example.com/main.jpg",
    "thumb": "https://example.com/thumb.jpg",
    "gallery": ["https://example.com/1.jpg", "https://example.com/2.jpg"]
  }
}
```

**配置：**
```json
{
  "complex_field_mappings": {
    "images": {
      "source_field": "images",
      "source_type": "json_object",
      "target_type": "json_array",
      "transform_options": {
        "extract_paths": ["main", "thumb", "gallery"],
        "flatten": true
      }
    }
  }
}
```

**结果：**
```json
{
  "images": "[\"https://example.com/main.jpg\", \"https://example.com/thumb.jpg\", \"https://example.com/1.jpg\", \"https://example.com/2.jpg\"]"
}
```

### 场景 6：图片存储在关联表

**源数据结构：**
```sql
-- products 表
CREATE TABLE products (product_id TEXT, name TEXT);

-- product_images 表
CREATE TABLE product_images (
  id TEXT,
  product_id TEXT,
  url TEXT,
  sort_order INTEGER
);
```

**配置：**
```json
{
  "complex_field_mappings": {
    "images": {
      "source_field": "product_id",
      "source_type": "foreign_table",
      "target_type": "json_array",
      "transform_options": {
        "foreign_table": "product_images",
        "foreign_key": "product_id",
        "value_field": "url",
        "order_field": "sort_order"
      }
    }
  }
}
```

---

## 三、值类型转换

### 1. 布尔值 → 整数

**源数据：** `available: true` 或 `available: 1`

```json
{
  "field_transformations": {
    "stock_quantity": {
      "type": "boolean_to_int",
      "true_value": 100,
      "false_value": 0
    }
  }
}
```

**结果：** `stock_quantity: 100`

### 2. 布尔值 → 字符串状态

**源数据：** `available: false`

```json
{
  "field_transformations": {
    "status": {
      "type": "boolean_to_status",
      "true_value": "active",
      "false_value": "archived"
    }
  }
}
```

**结果：** `status: "archived"`

### 3. 字符串 → 数字

**源数据：** `price: "55.0"` 或 `price: "N/A"`

```json
{
  "field_transformations": {
    "price": {
      "type": "float",
      "default": 0,
      "min": 0,
      "max": 99999
    }
  }
}
```

### 4. 日期字符串 → 时间戳

**源数据：** `created_at: "2024-01-15T10:30:00Z"`

```json
{
  "field_transformations": {
    "created_at": {
      "type": "timestamp",
      "format": "iso8601",
      "default": "now"
    }
  }
}
```

**结果：** `created_at: 1705312200000`

### 5. JSON字符串 → JSON对象

**源数据：** `attributes: '{"Size": "Large"}'`

```json
{
  "field_transformations": {
    "options_values": {
      "type": "json_parse",
      "default": {}
    }
  }
}
```

### 6. 计算字段

**源数据：** `price: 55.0`

```json
{
  "field_transformations": {
    "suggested_purchase_price": {
      "type": "calculated",
      "formula": "price * 0.6",
      "depends_on": ["price"]
    }
  }
}
```

**结果：** `suggested_purchase_price: 33.0`

---

## 四、外键关联（UUID转换）

### 问题描述

源数据库使用简单ID（如 `112`），目标数据库使用UUID格式（如 `f8f667b2-6b6f-b139-98ef-e41a55b1126c`）。

### 解决方案

```json
{
  "field_transformations": {
    "id": {
      "type": "uuid",
      "seed_template": "products-id-{product_id}"
    },
    "product_id": {
      "type": "foreign_key_uuid",
      "reference_table": "products",
      "reference_field": "id",
      "seed_template": "products-id-{product_id}"
    }
  }
}
```

**关键点：**
- `seed_template` 必须与被引用表的主键生成方式一致
- 使用 `{field_name}` 语法引用源字段值

---

## 五、完整示例

### 源数据库结构

```sql
CREATE TABLE shop_products (
  id INTEGER PRIMARY KEY,
  product_name TEXT,
  product_sku TEXT,
  product_images TEXT,  -- JSON数组字符串
  base_price REAL,
  is_available INTEGER,
  created TEXT,
  extra_data TEXT       -- JSON对象字符串
);

CREATE TABLE shop_variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER,
  variant_sku TEXT,
  variant_price REAL,
  variant_attributes TEXT  -- JSON对象字符串
);
```

### 目标数据库结构

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spu TEXT UNIQUE,
  images TEXT DEFAULT '[]',
  specifications TEXT DEFAULT '{}',
  price REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  sku TEXT UNIQUE NOT NULL,
  price REAL DEFAULT 0,
  options_values TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active'
);
```

### 配置文件

```json
{
  "source_path": "shop.db",
  "target_path": "target.db",
  "uuid_prefix": "shop",

  "table_mappings": [
    {
      "source_table": "shop_products",
      "target_table": "products",

      "field_mappings": {
        "id": "id",
        "name": "product_name",
        "spu": "product_sku",
        "images": "product_images",
        "price": "base_price",
        "status": "is_available",
        "created_at": "created",
        "specifications": "extra_data"
      },

      "field_transformations": {
        "id": {
          "type": "uuid",
          "seed_template": "products-id-{id}"
        },
        "images": {
          "type": "json_parse_or_array",
          "default": "[]"
        },
        "price": {
          "type": "float",
          "default": 0
        },
        "status": {
          "type": "boolean_to_status",
          "true_value": "active",
          "false_value": "archived"
        },
        "created_at": {
          "type": "timestamp",
          "default": "now"
        },
        "specifications": {
          "type": "json_parse",
          "default": "{}"
        }
      },

      "default_values": {
        "name": "Untitled",
        "images": "[]",
        "specifications": "{}"
      },

      "required_fields": ["id", "name"],
      "unique_fields": ["id", "spu"]
    },

    {
      "source_table": "shop_variants",
      "target_table": "product_variants",

      "field_mappings": {
        "id": "id",
        "product_id": "product_id",
        "sku": "variant_sku",
        "price": "variant_price",
        "options_values": "variant_attributes"
      },

      "field_transformations": {
        "id": {
          "type": "uuid",
          "seed_template": "product_variants-id-{id}"
        },
        "product_id": {
          "type": "foreign_key_uuid",
          "reference_table": "products",
          "reference_field": "id",
          "seed_template": "products-id-{product_id}"
        },
        "price": {
          "type": "float",
          "default": 0
        },
        "options_values": {
          "type": "json_parse",
          "default": "{}"
        }
      },

      "required_fields": ["id", "product_id", "sku"],
      "unique_fields": ["id", "sku"]
    }
  ]
}
```

---

## 六、转换器类型参考

| 类型 | 说明 | 参数 |
|------|------|------|
| `uuid` | 生成确定性UUID | `seed_template` |
| `timestamp` | 日期字符串转时间戳 | `format`, `default` |
| `float` | 转换为浮点数 | `default`, `min`, `max` |
| `int` | 转换为整数 | `default`, `min`, `max` |
| `json_parse` | JSON字符串解析 | `default` |
| `json_array` | 转换为JSON数组 | `separator`, `default` |
| `boolean_to_int` | 布尔值转整数 | `true_value`, `false_value` |
| `boolean_to_status` | 布尔值转状态 | `true_value`, `false_value` |
| `split_to_array` | 分隔符分割为数组 | `separator`, `trim`, `filter_empty` |
| `filename_from_url` | 从URL提取文件名 | `default` |
| `mime_type` | 从文件名推断MIME类型 | `default` |
| `html_clean` | 清理HTML标签 | `allowed_tags`, `strip_attributes` |
| `slug` | 从URL提取slug | `fallback` |
| `calculated` | 计算字段 | `formula`, `depends_on` |
| `constant` | 固定值 | `value` |
| `foreign_key_uuid` | 外键UUID转换 | `reference_table`, `seed_template` |

---

## 七、常见问题

### Q1: 图片字段是空的怎么办？

```json
{
  "images": {
    "type": "json_parse_or_array",
    "default": "[]"
  }
}
```

### Q2: 源字段值为NULL时如何处理？

在 `default_values` 中设置默认值：

```json
{
  "default_values": {
    "name": "Untitled",
    "price": 0,
    "status": "active"
  }
}
```

### Q3: 如何跳过某些记录？

在转换器中使用 `skip_if` 条件：

```json
{
  "field_transformations": {
    "price": {
      "type": "float",
      "skip_if": {
        "field": "status",
        "equals": "deleted"
      }
    }
  }
}
```

### Q4: 如何合并多个源字段？

使用 `complex_field_mappings`：

```json
{
  "specifications": {
    "source_fields": ["weight", "height", "width", "length"],
    "target_type": "json_object",
    "transform_options": {
      "mapping": {
        "weight": "weight_kg",
        "height": "height_cm",
        "width": "width_cm",
        "length": "length_cm"
      }
    }
  }
}
```

---

## 八、最佳实践

1. **先用 `--preview` 预览数据**，了解源数据结构
2. **使用 `--dry-run` 测试配置**，确保映射正确
3. **增量导入时使用 `--incremental`**，避免重复
4. **大批量导入时使用 `--checkpoint`**，支持断点续传
5. **保留配置文件**，便于重复使用和版本控制
