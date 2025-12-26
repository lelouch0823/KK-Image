<template>
  <div class="drag-upload-container">
    <!-- 拖拽区域 -->
    <div
      ref="dropZone"
      class="drop-zone"
      :class="{
        'drag-over': isDragOver,
        'uploading': isUploading
      }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @click="triggerFileInput"
    >
      <div class="drop-zone-content">
        <el-icon class="upload-icon" :size="48">
          <Upload />
        </el-icon>
        <div class="upload-text">
          <p class="primary-text">
            {{ isDragOver ? '释放文件开始上传' : '拖拽文件到此处上传' }}
          </p>
          <p class="secondary-text">
            或 <span class="click-text">点击选择文件</span>
          </p>
          <p class="hint-text">
            支持 JPG、PNG、GIF、WebP 格式，单文件最大 20MB
          </p>
        </div>
      </div>
      
      <!-- 上传进度覆盖层 -->
      <div v-if="isUploading" class="upload-overlay">
        <el-progress
          :percentage="uploadProgress"
          :stroke-width="6"
          status="success"
        />
        <p class="upload-status">{{ uploadStatusText }}</p>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInput"
      type="file"
      multiple
      accept="image/*"
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 文件列表 -->
    <div v-if="fileList.length > 0" class="file-list">
      <h4>上传队列 ({{ fileList.length }} 个文件)</h4>
      <div class="file-items">
        <div
          v-for="(file, index) in fileList"
          :key="file.uid"
          class="file-item"
          :class="file.status"
        >
          <div class="file-info">
            <el-icon class="file-icon">
              <Picture v-if="file.type.startsWith('image/')" />
              <Document v-else />
            </el-icon>
            <div class="file-details">
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ formatFileSize(file.size) }}</span>
            </div>
          </div>
          
          <div class="file-actions">
            <el-progress
              v-if="file.status === 'uploading'"
              :percentage="file.progress"
              :stroke-width="4"
              :show-text="false"
            />
            <el-icon
              v-else-if="file.status === 'success'"
              class="success-icon"
              color="#67c23a"
            >
              <Check />
            </el-icon>
            <el-icon
              v-else-if="file.status === 'error'"
              class="error-icon"
              color="#f56c6c"
            >
              <Close />
            </el-icon>
            <el-button
              v-if="file.status !== 'uploading'"
              type="text"
              size="small"
              @click="removeFile(index)"
            >
              移除
            </el-button>
          </div>
        </div>
      </div>
      
      <!-- 批量操作 -->
      <div class="batch-actions">
        <el-button
          type="primary"
          :disabled="isUploading || !hasReadyFiles"
          @click="startBatchUpload"
        >
          开始上传 ({{ readyFilesCount }})
        </el-button>
        <el-button
          :disabled="isUploading"
          @click="clearAll"
        >
          清空列表
        </el-button>
      </div>
    </div>

    <!-- 上传结果 -->
    <div v-if="uploadResults.length > 0" class="upload-results">
      <h4>上传结果</h4>
      <div class="result-items">
        <div
          v-for="result in uploadResults"
          :key="result.uid"
          class="result-item"
          :class="result.success ? 'success' : 'error'"
        >
          <div class="result-info">
            <span class="result-name">{{ result.name }}</span>
            <span v-if="result.success" class="result-url">
              {{ result.url }}
            </span>
            <span v-else class="result-error">
              {{ result.error }}
            </span>
          </div>
          <div class="result-actions">
            <el-button
              v-if="result.success"
              type="text"
              size="small"
              @click="copyUrl(result.url)"
            >
              复制链接
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { Upload, Picture, Document, Check, Close } from '@element-plus/icons-vue'

// 响应式数据
const dropZone = ref(null)
const fileInput = ref(null)
const isDragOver = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadStatusText = ref('')
const fileList = ref([])
const uploadResults = ref([])

// 计算属性
const hasReadyFiles = computed(() => 
  fileList.value.some(file => file.status === 'ready')
)

const readyFilesCount = computed(() => 
  fileList.value.filter(file => file.status === 'ready').length
)

// 拖拽事件处理
const handleDragEnter = (e) => {
  e.preventDefault()
  isDragOver.value = true
}

const handleDragOver = (e) => {
  e.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (e) => {
  e.preventDefault()
  // 只有当离开整个拖拽区域时才设置为false
  if (!dropZone.value.contains(e.relatedTarget)) {
    isDragOver.value = false
  }
}

const handleDrop = (e) => {
  e.preventDefault()
  isDragOver.value = false
  
  const files = Array.from(e.dataTransfer.files)
  processFiles(files)
}

// 文件选择处理
const triggerFileInput = () => {
  if (!isUploading.value) {
    fileInput.value.click()
  }
}

const handleFileSelect = (e) => {
  const files = Array.from(e.target.files)
  processFiles(files)
  // 清空input值，允许重复选择同一文件
  e.target.value = ''
}

// 文件处理
const processFiles = (files) => {
  const validFiles = files.filter(file => {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      ElMessage.warning(`${file.name} 不是有效的图片文件`)
      return false
    }
    
    // 检查文件大小 (20MB)
    if (file.size > 20 * 1024 * 1024) {
      ElMessage.warning(`${file.name} 文件大小超过 20MB`)
      return false
    }
    
    return true
  })
  
  validFiles.forEach(file => {
    const fileItem = {
      uid: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      status: 'ready', // ready, uploading, success, error
      progress: 0
    }
    fileList.value.push(fileItem)
  })
  
  if (validFiles.length > 0) {
    ElMessage.success(`已添加 ${validFiles.length} 个文件到上传队列`)
  }
}

// 文件上传
const startBatchUpload = async () => {
  const readyFiles = fileList.value.filter(file => file.status === 'ready')
  if (readyFiles.length === 0) return
  
  isUploading.value = true
  uploadProgress.value = 0
  uploadStatusText.value = '准备上传...'
  
  let completedCount = 0
  const totalCount = readyFiles.length
  
  for (const fileItem of readyFiles) {
    try {
      fileItem.status = 'uploading'
      uploadStatusText.value = `正在上传 ${fileItem.name}...`
      
      const result = await uploadSingleFile(fileItem)
      
      fileItem.status = 'success'
      fileItem.progress = 100
      
      uploadResults.value.push({
        uid: fileItem.uid,
        name: fileItem.name,
        success: true,
        url: result.url
      })
      
      completedCount++
      uploadProgress.value = Math.round((completedCount / totalCount) * 100)
      
    } catch (error) {
      fileItem.status = 'error'
      uploadResults.value.push({
        uid: fileItem.uid,
        name: fileItem.name,
        success: false,
        error: error.message
      })
      
      completedCount++
      uploadProgress.value = Math.round((completedCount / totalCount) * 100)
    }
  }
  
  isUploading.value = false
  uploadStatusText.value = '上传完成'
  
  ElNotification({
    title: '上传完成',
    message: `成功上传 ${uploadResults.value.filter(r => r.success).length} 个文件`,
    type: 'success'
  })
}

// 单文件上传
const uploadSingleFile = async (fileItem) => {
  const formData = new FormData()
  formData.append('file', fileItem.file)
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    // 上传进度
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        fileItem.progress = Math.round((e.loaded / e.total) * 100)
      }
    })
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText)
          // 处理数组格式的响应 [{ src: '/file/xxx' }]
          if (Array.isArray(response) && response.length > 0) {
            resolve({ url: window.location.origin + response[0].src })
          } else if (response.src) {
            resolve({ url: window.location.origin + response.src })
          } else {
            resolve(response)
          }
        } catch (e) {
          reject(new Error('响应格式错误'))
        }
      } else {
        reject(new Error(`上传失败: ${xhr.status}`))
      }
    })
    
    xhr.addEventListener('error', () => {
      reject(new Error('网络错误'))
    })
    
    xhr.open('POST', '/upload')
    xhr.send(formData)
  })
}

// 工具函数
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const removeFile = (index) => {
  fileList.value.splice(index, 1)
}

const clearAll = () => {
  fileList.value = []
  uploadResults.value = []
}

const copyUrl = async (url) => {
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('链接已复制到剪贴板')
  } catch (e) {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = url
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('链接已复制到剪贴板')
  }
}

// 生命周期
onMounted(() => {
  // 防止页面默认拖拽行为
  document.addEventListener('dragover', preventDefault)
  document.addEventListener('drop', preventDefault)
})

onUnmounted(() => {
  document.removeEventListener('dragover', preventDefault)
  document.removeEventListener('drop', preventDefault)
})

const preventDefault = (e) => {
  e.preventDefault()
}
</script>

<style scoped>
.drag-upload-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.drop-zone {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.drop-zone.drag-over {
  border-color: #67c23a;
  background-color: #f0f9ff;
  transform: scale(1.02);
}

.drop-zone.uploading {
  pointer-events: none;
}

.drop-zone-content {
  z-index: 1;
}

.upload-icon {
  color: #c0c4cc;
  margin-bottom: 16px;
}

.drag-over .upload-icon {
  color: #67c23a;
}

.upload-text .primary-text {
  font-size: 16px;
  color: #303133;
  margin: 0 0 8px 0;
}

.upload-text .secondary-text {
  font-size: 14px;
  color: #606266;
  margin: 0 0 8px 0;
}

.upload-text .click-text {
  color: #409eff;
  text-decoration: underline;
}

.upload-text .hint-text {
  font-size: 12px;
  color: #909399;
  margin: 0;
}

.upload-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.upload-status {
  margin-top: 16px;
  color: #606266;
  font-size: 14px;
}

.file-list {
  margin-top: 24px;
}

.file-list h4 {
  margin: 0 0 16px 0;
  color: #303133;
}

.file-items {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  transition: background-color 0.3s;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:hover {
  background-color: #f5f7fa;
}

.file-item.uploading {
  background-color: #ecf5ff;
}

.file-item.success {
  background-color: #f0f9ff;
}

.file-item.error {
  background-color: #fef0f0;
}

.file-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.file-icon {
  margin-right: 12px;
  color: #909399;
}

.file-details {
  display: flex;
  flex-direction: column;
}

.file-name {
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.file-size {
  font-size: 12px;
  color: #909399;
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-actions {
  margin-top: 16px;
  text-align: center;
}

.batch-actions .el-button {
  margin: 0 8px;
}

.upload-results {
  margin-top: 24px;
}

.upload-results h4 {
  margin: 0 0 16px 0;
  color: #303133;
}

.result-items {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item.success {
  background-color: #f0f9ff;
}

.result-item.error {
  background-color: #fef0f0;
}

.result-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.result-name {
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.result-url {
  font-size: 12px;
  color: #67c23a;
  word-break: break-all;
}

.result-error {
  font-size: 12px;
  color: #f56c6c;
}

.result-actions {
  margin-left: 16px;
}
</style>
