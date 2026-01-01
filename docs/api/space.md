# Space API

> **Base URL**: `/api/space/:token`

## 1. 获取空间详情
`GET /api/space/:token`

返回空间的基础信息（名称、描述、模板类型）和根目录文件列表。

**Headers (Optional):**
- `x-space-password`: 如果空间设有密码，需提供此 Header。

**Response:**
```json
{
  "success": true,
  "data": {
    "info": {
      "name": "2024新品发布会",
      "template": "gallery",
      "is_public": true
    },
    "files": [ ... ],
    "folders": [ ... ]
  }
}
```

## 2. 获取文件夹内容
`GET /api/space/:token/folder/:folderId`

获取二级目录下内容。

## 3. 文件下载
`GET /api/space/:token/download/:fileId`

获取文件的临时下载链接（R2 Signed URL）。
