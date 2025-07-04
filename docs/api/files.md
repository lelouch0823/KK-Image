# 文件管理 API

## 概述

文件管理 API 提供完整的文件 CRUD 操作，支持图片和视频文件的上传、查询、更新和删除。

## 端点列表

### 1. 获取文件列表

**请求**
```http
GET /api/v1/files
```

**查询参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `page` | integer | 否 | 页码，默认 1 |
| `limit` | integer | 否 | 每页数量，默认 20，最大 100 |
| `search` | string | 否 | 搜索关键词，支持文件名搜索 |
| `type` | string | 否 | 文件类型过滤 (image/video) |
| `status` | string | 否 | 文件状态 (active/deleted) |
| `sort` | string | 否 | 排序字段 (uploadTime/size/name) |
| `order` | string | 否 | 排序方向 (asc/desc)，默认 desc |
| `tags` | string | 否 | 标签过滤，多个标签用逗号分隔 |
| `startDate` | string | 否 | 开始日期 (ISO 8601 格式) |
| `endDate` | string | 否 | 结束日期 (ISO 8601 格式) |

**权限要求**: `read`

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "id": "img_1234567890",
      "filename": "example.jpg",
      "originalName": "my-photo.jpg",
      "url": "https://your-domain.com/file/img_1234567890",
      "type": "image/jpeg",
      "size": 1024000,
      "uploadTime": "2024-01-15T10:30:00Z",
      "lastModified": "2024-01-15T10:30:00Z",
      "status": "active",
      "metadata": {
        "width": 1920,
        "height": 1080,
        "exif": {
          "camera": "iPhone 12",
          "location": "Beijing"
        }
      },
      "tags": ["photo", "landscape"],
      "uploadedBy": "user123",
      "downloadCount": 42,
      "lastAccessed": "2024-01-20T15:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 2. 获取单个文件信息

**请求**
```http
GET /api/v1/files/{id}
```

**路径参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `id` | string | 是 | 文件 ID |

**权限要求**: `read`

**响应示例**
```json
{
  "success": true,
  "data": {
    "id": "img_1234567890",
    "filename": "example.jpg",
    "originalName": "my-photo.jpg",
    "url": "https://your-domain.com/file/img_1234567890",
    "type": "image/jpeg",
    "size": 1024000,
    "uploadTime": "2024-01-15T10:30:00Z",
    "lastModified": "2024-01-15T10:30:00Z",
    "status": "active",
    "metadata": {
      "width": 1920,
      "height": 1080,
      "exif": {
        "camera": "iPhone 12",
        "location": "Beijing"
      }
    },
    "tags": ["photo", "landscape"],
    "uploadedBy": "user123",
    "downloadCount": 42,
    "lastAccessed": "2024-01-20T15:45:00Z"
  }
}
```

### 3. 上传文件

**请求**
```http
POST /api/v1/files
Content-Type: multipart/form-data
```

**表单参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `file` | file | 是 | 要上传的文件 |
| `tags` | string | 否 | 文件标签，多个标签用逗号分隔 |
| `description` | string | 否 | 文件描述 |
| `customFilename` | string | 否 | 自定义文件名 |

**权限要求**: `write`

**响应示例**
```json
{
  "success": true,
  "data": {
    "id": "img_1234567890",
    "filename": "example.jpg",
    "originalName": "my-photo.jpg",
    "url": "https://your-domain.com/file/img_1234567890",
    "type": "image/jpeg",
    "size": 1024000,
    "uploadTime": "2024-01-15T10:30:00Z",
    "status": "active",
    "metadata": {
      "width": 1920,
      "height": 1080
    },
    "tags": ["photo", "landscape"],
    "uploadedBy": "user123"
  }
}
```

### 4. 更新文件信息

**请求**
```http
PUT /api/v1/files/{id}
Content-Type: application/json
```

**路径参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `id` | string | 是 | 文件 ID |

**请求体**
```json
{
  "tags": ["photo", "updated"],
  "description": "更新后的描述",
  "customFilename": "new-filename.jpg",
  "metadata": {
    "customField": "customValue"
  }
}
```

**权限要求**: `write`

**响应示例**
```json
{
  "success": true,
  "data": {
    "id": "img_1234567890",
    "filename": "new-filename.jpg",
    "originalName": "my-photo.jpg",
    "url": "https://your-domain.com/file/img_1234567890",
    "type": "image/jpeg",
    "size": 1024000,
    "uploadTime": "2024-01-15T10:30:00Z",
    "lastModified": "2024-01-20T16:00:00Z",
    "status": "active",
    "metadata": {
      "width": 1920,
      "height": 1080,
      "customField": "customValue"
    },
    "tags": ["photo", "updated"],
    "description": "更新后的描述",
    "uploadedBy": "user123"
  }
}
```

### 5. 删除文件

**请求**
```http
DELETE /api/v1/files/{id}
```

**路径参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `id` | string | 是 | 文件 ID |

**查询参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `permanent` | boolean | 否 | 是否永久删除，默认 false (软删除) |

**权限要求**: `delete`

**响应示例**
```json
{
  "success": true,
  "message": "文件删除成功",
  "data": {
    "id": "img_1234567890",
    "status": "deleted",
    "deletedAt": "2024-01-20T16:30:00Z",
    "deletedBy": "user123"
  }
}
```

## 错误响应

### 文件不存在
```json
{
  "success": false,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "文件不存在",
    "details": "File with ID 'img_1234567890' not found"
  }
}
```

### 文件类型不支持
```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "不支持的文件类型",
    "details": "File type 'application/pdf' is not supported"
  }
}
```

### 文件大小超限
```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "文件大小超出限制",
    "details": "File size 15MB exceeds the limit of 10MB for images"
  }
}
```

## 使用示例

### JavaScript
```javascript
// 上传文件
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('tags', 'photo,landscape');

const response = await fetch('/api/v1/files', {
  method: 'POST',
  headers: {
    'X-API-Key': 'tk_your_api_key_here'
  },
  body: formData
});

const result = await response.json();
```

### cURL
```bash
# 上传文件
curl -X POST \
  -H "X-API-Key: tk_your_api_key_here" \
  -F "file=@photo.jpg" \
  -F "tags=photo,landscape" \
  https://your-domain.com/api/v1/files

# 获取文件列表
curl -H "X-API-Key: tk_your_api_key_here" \
  "https://your-domain.com/api/v1/files?page=1&limit=10&type=image"

# 删除文件
curl -X DELETE \
  -H "X-API-Key: tk_your_api_key_here" \
  https://your-domain.com/api/v1/files/img_1234567890
```
