# SDK 和示例代码

## 概述

本文档提供了 Telegraph-Image API 的 SDK 和各种编程语言的示例代码，帮助开发者快速集成 API 功能。

## JavaScript SDK

### 安装
```bash
npm install telegraph-image-sdk
```

### 基础用法
```javascript
import TelegraphImageAPI from 'telegraph-image-sdk';

// 初始化客户端
const client = new TelegraphImageAPI({
  baseURL: 'https://your-domain.com/api/v1',
  apiKey: 'tk_your_api_key_here'
});

// 上传文件
const file = document.getElementById('fileInput').files[0];
const result = await client.files.upload(file, {
  tags: ['photo', 'landscape'],
  description: '美丽的风景照片'
});

console.log('上传成功:', result.data);

// 获取文件列表
const files = await client.files.list({
  page: 1,
  limit: 20,
  type: 'image'
});

console.log('文件列表:', files.data);

// 删除文件
await client.files.delete('img_1234567890');
```

### 高级用法
```javascript
// 使用 JWT Token 认证
const client = new TelegraphImageAPI({
  baseURL: 'https://your-domain.com/api/v1',
  token: 'your_jwt_token_here'
});

// 批量上传
const files = Array.from(document.getElementById('multipleFiles').files);
const uploadPromises = files.map(file => 
  client.files.upload(file, { tags: ['batch'] })
);

const results = await Promise.allSettled(uploadPromises);
const successful = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');

console.log(`成功上传 ${successful.length} 个文件`);
console.log(`失败 ${failed.length} 个文件`);

// 搜索文件
const searchResults = await client.files.search({
  query: '风景',
  tags: ['photo'],
  startDate: '2024-01-01',
  endDate: '2024-12-31'
});

// 创建 Webhook
const webhook = await client.webhooks.create({
  url: 'https://your-app.com/webhook',
  events: ['file.uploaded', 'file.deleted'],
  secret: 'your_webhook_secret'
});

// 管理 API Keys
const apiKeys = await client.auth.listApiKeys();
const newKey = await client.auth.createApiKey({
  name: 'Frontend App',
  permissions: ['read', 'write']
});
```

## Python SDK

### 安装
```bash
pip install telegraph-image-python
```

### 基础用法
```python
from telegraph_image import TelegraphImageAPI

# 初始化客户端
client = TelegraphImageAPI(
    base_url='https://your-domain.com/api/v1',
    api_key='tk_your_api_key_here'
)

# 上传文件
with open('photo.jpg', 'rb') as f:
    result = client.files.upload(
        file=f,
        tags=['photo', 'landscape'],
        description='美丽的风景照片'
    )
    print(f'上传成功: {result["data"]["id"]}')

# 获取文件列表
files = client.files.list(page=1, limit=20, type='image')
print(f'共找到 {files["pagination"]["total"]} 个文件')

# 搜索文件
search_results = client.files.search(
    query='风景',
    tags=['photo'],
    start_date='2024-01-01',
    end_date='2024-12-31'
)

# 批量操作
import concurrent.futures
import os

def upload_file(file_path):
    with open(file_path, 'rb') as f:
        return client.files.upload(f, tags=['batch'])

# 批量上传目录中的所有图片
image_files = [f for f in os.listdir('./images') if f.lower().endswith(('.jpg', '.png', '.gif'))]

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    futures = [executor.submit(upload_file, f'./images/{file}') for file in image_files]
    
    for future in concurrent.futures.as_completed(futures):
        try:
            result = future.result()
            print(f'上传成功: {result["data"]["filename"]}')
        except Exception as e:
            print(f'上传失败: {e}')
```

### 异步版本
```python
import asyncio
import aiohttp
from telegraph_image.async_client import AsyncTelegraphImageAPI

async def main():
    async with AsyncTelegraphImageAPI(
        base_url='https://your-domain.com/api/v1',
        api_key='tk_your_api_key_here'
    ) as client:
        
        # 异步上传
        with open('photo.jpg', 'rb') as f:
            result = await client.files.upload(f)
            print(f'上传成功: {result["data"]["id"]}')
        
        # 异步获取文件列表
        files = await client.files.list()
        print(f'文件数量: {len(files["data"])}')

# 运行异步代码
asyncio.run(main())
```

## PHP SDK

### 安装
```bash
composer require telegraph-image/php-sdk
```

### 基础用法
```php
<?php
require_once 'vendor/autoload.php';

use TelegraphImage\Client;

// 初始化客户端
$client = new Client([
    'base_url' => 'https://your-domain.com/api/v1',
    'api_key' => 'tk_your_api_key_here'
]);

// 上传文件
$result = $client->files()->upload([
    'file' => new CURLFile('photo.jpg'),
    'tags' => 'photo,landscape',
    'description' => '美丽的风景照片'
]);

echo "上传成功: " . $result['data']['id'] . "\n";

// 获取文件列表
$files = $client->files()->list([
    'page' => 1,
    'limit' => 20,
    'type' => 'image'
]);

echo "共找到 " . $files['pagination']['total'] . " 个文件\n";

// 搜索文件
$searchResults = $client->files()->search([
    'query' => '风景',
    'tags' => 'photo',
    'start_date' => '2024-01-01',
    'end_date' => '2024-12-31'
]);

// 批量上传
$imageFiles = glob('./images/*.{jpg,png,gif}', GLOB_BRACE);

foreach ($imageFiles as $filePath) {
    try {
        $result = $client->files()->upload([
            'file' => new CURLFile($filePath),
            'tags' => 'batch'
        ]);
        echo "上传成功: " . basename($filePath) . "\n";
    } catch (Exception $e) {
        echo "上传失败: " . basename($filePath) . " - " . $e->getMessage() . "\n";
    }
}

// Webhook 管理
$webhook = $client->webhooks()->create([
    'url' => 'https://your-app.com/webhook',
    'events' => ['file.uploaded', 'file.deleted'],
    'secret' => 'your_webhook_secret'
]);

echo "Webhook 创建成功: " . $webhook['data']['id'] . "\n";
?>
```

## cURL 示例

### 基础操作
```bash
# 获取系统信息
curl https://your-domain.com/api/v1/info

# 健康检查
curl https://your-domain.com/api/v1/health

# 生成 JWT Token
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' \
  https://your-domain.com/api/v1/auth/token

# 获取文件列表
curl -H "X-API-Key: tk_your_api_key_here" \
  https://your-domain.com/api/v1/files

# 上传文件
curl -X POST \
  -H "X-API-Key: tk_your_api_key_here" \
  -F "file=@photo.jpg" \
  -F "tags=photo,landscape" \
  https://your-domain.com/api/v1/files

# 搜索文件
curl -H "X-API-Key: tk_your_api_key_here" \
  "https://your-domain.com/api/v1/files?search=风景&tags=photo&page=1&limit=10"

# 删除文件
curl -X DELETE \
  -H "X-API-Key: tk_your_api_key_here" \
  https://your-domain.com/api/v1/files/img_1234567890
```

### Webhook 操作
```bash
# 创建 Webhook
curl -X POST \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["file.uploaded", "file.deleted"],
    "secret": "your_webhook_secret"
  }' \
  https://your-domain.com/api/v1/webhooks

# 测试 Webhook
curl -X POST \
  -H "Authorization: Bearer your_jwt_token" \
  https://your-domain.com/api/v1/webhooks/webhook_1234567890/test

# 删除 Webhook
curl -X DELETE \
  -H "Authorization: Bearer your_jwt_token" \
  https://your-domain.com/api/v1/webhooks/webhook_1234567890

## Go SDK

### 安装
```bash
go get github.com/telegraph-image/go-sdk
```

### 基础用法
```go
package main

import (
    "fmt"
    "log"
    "os"

    "github.com/telegraph-image/go-sdk"
)

func main() {
    // 初始化客户端
    client := telegraphimage.NewClient(&telegraphimage.Config{
        BaseURL: "https://your-domain.com/api/v1",
        APIKey:  "tk_your_api_key_here",
    })

    // 上传文件
    file, err := os.Open("photo.jpg")
    if err != nil {
        log.Fatal(err)
    }
    defer file.Close()

    result, err := client.Files.Upload(&telegraphimage.UploadRequest{
        File:        file,
        Tags:        []string{"photo", "landscape"},
        Description: "美丽的风景照片",
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("上传成功: %s\n", result.Data.ID)

    // 获取文件列表
    files, err := client.Files.List(&telegraphimage.ListRequest{
        Page:  1,
        Limit: 20,
        Type:  "image",
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("共找到 %d 个文件\n", files.Pagination.Total)
}
```

## 实际应用示例

### 1. 图片上传组件 (React)
```jsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import TelegraphImageAPI from 'telegraph-image-sdk';

const client = new TelegraphImageAPI({
  baseURL: process.env.REACT_APP_API_URL,
  apiKey: process.env.REACT_APP_API_KEY
});

function ImageUploader() {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const onDrop = useCallback(async (acceptedFiles) => {
    setUploading(true);

    try {
      const uploadPromises = acceptedFiles.map(file =>
        client.files.upload(file, {
          tags: ['user-upload'],
          description: file.name
        })
      );

      const results = await Promise.allSettled(uploadPromises);
      const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value.data);

      setUploadedFiles(prev => [...prev, ...successful]);
    } catch (error) {
      console.error('上传失败:', error);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true
  });

  return (
    <div>
      <div {...getRootProps()} className="dropzone">
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>拖拽文件到这里...</p>
        ) : (
          <p>拖拽文件到这里，或点击选择文件</p>
        )}
      </div>

      {uploading && <p>上传中...</p>}

      <div className="uploaded-files">
        {uploadedFiles.map(file => (
          <div key={file.id} className="file-item">
            <img src={file.url} alt={file.filename} />
            <p>{file.filename}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ImageUploader;
```

### 2. 文件管理后台 (Vue.js)
```vue
<template>
  <div class="file-manager">
    <div class="toolbar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索文件..."
        @input="handleSearch"
        clearable
      />
      <el-select v-model="selectedType" @change="handleFilter">
        <el-option label="所有类型" value="" />
        <el-option label="图片" value="image" />
        <el-option label="视频" value="video" />
      </el-select>
    </div>

    <el-table :data="files" v-loading="loading">
      <el-table-column prop="filename" label="文件名" />
      <el-table-column prop="type" label="类型" />
      <el-table-column prop="size" label="大小" :formatter="formatSize" />
      <el-table-column prop="uploadTime" label="上传时间" :formatter="formatDate" />
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button size="small" @click="viewFile(row)">查看</el-button>
          <el-button size="small" type="danger" @click="deleteFile(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      :current-page="currentPage"
      :page-size="pageSize"
      :total="total"
      @current-change="handlePageChange"
    />
  </div>
</template>

<script>
import TelegraphImageAPI from 'telegraph-image-sdk';

const client = new TelegraphImageAPI({
  baseURL: process.env.VUE_APP_API_URL,
  apiKey: process.env.VUE_APP_API_KEY
});

export default {
  name: 'FileManager',
  data() {
    return {
      files: [],
      loading: false,
      searchQuery: '',
      selectedType: '',
      currentPage: 1,
      pageSize: 20,
      total: 0
    };
  },
  mounted() {
    this.loadFiles();
  },
  methods: {
    async loadFiles() {
      this.loading = true;
      try {
        const response = await client.files.list({
          page: this.currentPage,
          limit: this.pageSize,
          search: this.searchQuery,
          type: this.selectedType
        });

        this.files = response.data;
        this.total = response.pagination.total;
      } catch (error) {
        this.$message.error('加载文件失败');
      } finally {
        this.loading = false;
      }
    },

    handleSearch() {
      this.currentPage = 1;
      this.loadFiles();
    },

    handleFilter() {
      this.currentPage = 1;
      this.loadFiles();
    },

    handlePageChange(page) {
      this.currentPage = page;
      this.loadFiles();
    },

    async deleteFile(file) {
      try {
        await this.$confirm('确定要删除这个文件吗？', '确认删除');
        await client.files.delete(file.id);
        this.$message.success('删除成功');
        this.loadFiles();
      } catch (error) {
        if (error !== 'cancel') {
          this.$message.error('删除失败');
        }
      }
    },

    viewFile(file) {
      window.open(file.url, '_blank');
    },

    formatSize(row) {
      const size = row.size;
      if (size < 1024) return size + ' B';
      if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
      return (size / (1024 * 1024)).toFixed(1) + ' MB';
    },

    formatDate(row) {
      return new Date(row.uploadTime).toLocaleString();
    }
  }
};
</script>
```

### 3. Webhook 处理服务 (Node.js/Express)
```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Webhook 签名验证中间件
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  const secret = process.env.WEBHOOK_SECRET;

  if (!signature || !secret) {
    return res.status(401).send('Missing signature or secret');
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const receivedSignature = signature.replace('sha256=', '');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  next();
}

// Webhook 处理端点
app.post('/webhook', verifyWebhookSignature, (req, res) => {
  const { event, data, timestamp } = req.body;

  console.log(`收到 Webhook 事件: ${event} at ${timestamp}`);

  switch (event) {
    case 'file.uploaded':
      handleFileUploaded(data);
      break;
    case 'file.updated':
      handleFileUpdated(data);
      break;
    case 'file.deleted':
      handleFileDeleted(data);
      break;
    default:
      console.log('未知事件类型:', event);
  }

  res.status(200).send('OK');
});

function handleFileUploaded(data) {
  const { file, user } = data;
  console.log(`用户 ${user.name} 上传了文件: ${file.filename}`);

  // 发送通知邮件
  sendNotificationEmail({
    to: 'admin@example.com',
    subject: '新文件上传',
    body: `用户 ${user.name} 上传了文件 ${file.filename}`
  });

  // 更新统计数据
  updateUploadStats(user.id, file.size);
}

function handleFileUpdated(data) {
  const { file, changes, user } = data;
  console.log(`用户 ${user.name} 更新了文件: ${file.filename}`);
  console.log('变更内容:', changes);
}

function handleFileDeleted(data) {
  const { file, user } = data;
  console.log(`用户 ${user.name} 删除了文件: ${file.filename}`);

  // 清理相关数据
  cleanupFileReferences(file.id);
}

app.listen(3000, () => {
  console.log('Webhook 服务器运行在端口 3000');
});
```
```
