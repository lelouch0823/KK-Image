<template>
  <div id="app">
    <el-container>
      <el-header>
        <div class="header-content">
          <span class="title" @click="refreshDashboard">Dashboard</span>
          <div class="search-card">
            <el-input 
              v-model="search" 
              size="small" 
              placeholder="输入关键字搜索"
              clearable
            />
          </div>
          <el-tooltip content="批量上传" placement="bottom">
            <span class="stats" @click="handleUpload">
              <el-icon class="upload-icon"><Upload /></el-icon>
              <span class="stats-text">记录数: </span>{{ totalFiles }}
            </span>
          </el-tooltip>
          <input 
            type="file" 
            ref="fileInputRef" 
            style="display: none;" 
            multiple 
            @change="uploadFiles"
          >
          <div class="actions">
            <el-tooltip content="文件类型" placement="bottom">
              <el-dropdown @command="switchFileType" :hide-on-click="false">
                <span class="el-dropdown-link">
                  <el-icon><component :is="fileTypeIcon" /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item 
                      v-for="(config, type) in fileConfig" 
                      :key="type"
                      :command="type" 
                      :class="{ 'is-selected': fileType === type }"
                    >
                      <el-icon><component :is="config.icon" /></el-icon>
                      {{ config.name }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-tooltip>
            
            <el-tooltip content="排序" placement="bottom">
              <el-dropdown @command="sort" :hide-on-click="false">
                <span class="el-dropdown-link">
                  <el-icon><component :is="sortIcon" /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item 
                      command="dateDesc" 
                      :class="{ 'is-selected': sortOption === 'dateDesc' }"
                    >
                      <el-icon><SortDown /></el-icon> 按时间倒序
                    </el-dropdown-item>
                    <el-dropdown-item 
                      command="nameAsc" 
                      :class="{ 'is-selected': sortOption === 'nameAsc' }"
                    >
                      <el-icon><SortUp /></el-icon> 按名称升序
                    </el-dropdown-item>
                    <el-dropdown-item 
                      command="sizeDesc" 
                      :class="{ 'is-selected': sortOption === 'sizeDesc' }"
                    >
                      <el-icon><SortDown /></el-icon> 按大小倒序
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-tooltip>
          </div>
        </div>
      </el-header>

      <el-main>
        <!-- 文件列表 -->
        <div class="file-grid" v-loading="loading">
          <div 
            v-for="item in paginatedData" 
            :key="item.name"
            class="file-item"
            :class="{ 'selected': item.selected }"
            @click="toggleSelection(item)"
          >
            <div class="file-preview">
              <img 
                v-if="isImage(item)" 
                :src="getFileUrl(item)" 
                :alt="item.metadata.fileName"
                @error="handleImageError"
              />
              <div v-else class="file-icon">
                <el-icon size="48"><Document /></el-icon>
              </div>
            </div>
            
            <div class="file-info">
              <div class="file-name" :title="item.metadata.fileName">
                {{ item.metadata.fileName }}
              </div>
              <div class="file-meta">
                <span class="file-size">{{ formatFileSize(item.metadata.fileSize) }}</span>
                <span class="file-date">{{ formatDate(item.metadata.TimeStamp) }}</span>
              </div>
            </div>
            
            <div class="file-actions">
              <el-button 
                type="primary" 
                size="small" 
                @click.stop="copyUrl(item)"
              >
                复制链接
              </el-button>
              <el-button 
                type="danger" 
                size="small" 
                @click.stop="deleteFile(item)"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[15, 30, 50, 100]"
          :total="filteredData.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />

        <!-- 批量操作 -->
        <div v-if="selectedFiles.length > 0" class="batch-actions">
          <el-button type="danger" @click="batchDelete">
            批量删除 ({{ selectedFiles.length }})
          </el-button>
          <el-button @click="clearSelection">取消选择</el-button>
        </div>
      </el-main>
    </el-container>

    <!-- 上传进度对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="批量上传" width="600px">
      <div class="upload-progress">
        <el-progress 
          :percentage="uploadProgress" 
          :status="uploadStatus"
          :stroke-width="8"
        />
        <div class="upload-stats">
          <span>已完成: {{ uploadCompleted }}</span>
          <span>总数: {{ uploadTotal }}</span>
          <span>失败: {{ uploadFailed }}</span>
        </div>
      </div>
      <div class="upload-logs" v-if="uploadLogs.length > 0">
        <div 
          v-for="(log, index) in uploadLogs" 
          :key="index"
          :class="['upload-log', log.type]"
        >
          {{ log.message }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus';
import { 
  Upload, Document, Picture, VideoPlay, Headphones, 
  FolderOpened, SortDown, SortUp, Filter 
} from '@element-plus/icons-vue';

// 响应式数据
const loading = ref(false);
const search = ref('');
const currentPage = ref(1);
const pageSize = ref(15);
const tableData = ref([]);
const selectedFiles = ref([]);
const sortOption = ref('dateDesc');
const filterOption = ref('all');
const fileType = ref('image');
const fileInputRef = ref();

// 上传相关
const uploadDialogVisible = ref(false);
const uploadProgress = ref(0);
const uploadStatus = ref('');
const uploadCompleted = ref(0);
const uploadTotal = ref(0);
const uploadFailed = ref(0);
const uploadLogs = ref([]);

// 配置对象
const fileConfig = reactive({
  image: {
    name: '图片',
    exts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'ico'],
    icon: Picture,
    count: 0
  },
  video: {
    name: '视频',
    exts: ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv'],
    icon: VideoPlay,
    count: 0
  },
  audio: {
    name: '音频',
    exts: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'],
    icon: Headphones,
    count: 0
  },
  document: {
    name: '文件',
    exts: [],
    icon: FolderOpened,
    count: 0
  }
});

const uploadConfig = reactive({
  maxSize: 20 * 1024 * 1024,  // 最大上传20MB
  maxConcurrent: 3
});

// 计算属性
const totalFiles = computed(() => tableData.value.length);

const fileTypeIcon = computed(() => fileConfig[fileType.value]?.icon || Picture);

const sortIcon = computed(() => {
  return sortOption.value.includes('Desc') ? SortDown : SortUp;
});

const filteredData = computed(() => {
  let data = tableData.value;
  
  // 文件类型筛选
  if (fileType.value !== 'all') {
    const exts = fileConfig[fileType.value].exts;
    data = data.filter(item => {
      const ext = getFileExtension(item.name).toLowerCase();
      return exts.length === 0 || exts.includes(ext);
    });
  }
  
  // 搜索筛选
  if (search.value) {
    data = data.filter(item => 
      item.metadata.fileName.toLowerCase().includes(search.value.toLowerCase())
    );
  }
  
  // 排序
  data = [...data].sort((a, b) => {
    switch (sortOption.value) {
      case 'dateDesc':
        return b.metadata.TimeStamp - a.metadata.TimeStamp;
      case 'nameAsc':
        return a.metadata.fileName.localeCompare(b.metadata.fileName);
      case 'sizeDesc':
        return (b.metadata.fileSize || 0) - (a.metadata.fileSize || 0);
      default:
        return 0;
    }
  });
  
  return data;
});

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredData.value.slice(start, end);
});

// 工具函数
const getFileExtension = (filename) => {
  return filename.split('.').pop() || '';
};

const isImage = (item) => {
  const ext = getFileExtension(item.name).toLowerCase();
  return fileConfig.image.exts.includes(ext);
};

const getFileUrl = (item) => {
  return `${window.location.origin}/file/${item.name}`;
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

// 方法定义
const refreshDashboard = async () => {
  loading.value = true;
  try {
    const response = await fetch('./api/manage/list', {
      method: 'GET',
      credentials: 'include'
    });
    const result = await response.json();

    tableData.value = result.map(file => ({
      ...file,
      selected: false,
      metadata: {
        ...file.metadata,
        liked: file.metadata.liked ?? false,
        fileName: file.metadata.fileName ?? file.name,
        fileSize: file.metadata.fileSize ?? 0
      }
    }));

    updateStats();
    ElMessage.success('数据刷新成功');
  } catch (error) {
    ElMessage.error('同步数据时出错，请检查网络连接');
  } finally {
    loading.value = false;
  }
};

const handleUpload = () => {
  fileInputRef.value?.click();
};

const uploadFiles = async (event) => {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  // 验证文件
  const validFiles = files.filter(file => {
    if (file.size > uploadConfig.maxSize) {
      ElMessage.error(`文件 ${file.name} 超过大小限制`);
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) return;

  // 显示上传对话框
  uploadDialogVisible.value = true;
  uploadProgress.value = 0;
  uploadCompleted.value = 0;
  uploadTotal.value = validFiles.length;
  uploadFailed.value = 0;
  uploadLogs.value = [];
  uploadStatus.value = '';

  try {
    // 分批并发上传
    for (let i = 0; i < validFiles.length; i += uploadConfig.maxConcurrent) {
      const batch = validFiles.slice(i, i + uploadConfig.maxConcurrent);

      await Promise.all(
        batch.map(async (file) => {
          try {
            await uploadSingleFile(file);
            uploadCompleted.value++;
            uploadLogs.value.push({
              type: 'success',
              message: `✓ ${file.name} 上传成功`
            });
          } catch (error) {
            uploadFailed.value++;
            uploadLogs.value.push({
              type: 'error',
              message: `✗ ${file.name} 上传失败: ${error.message}`
            });
          }

          uploadProgress.value = Math.round(
            ((uploadCompleted.value + uploadFailed.value) / uploadTotal.value) * 100
          );
        })
      );
    }

    uploadStatus.value = uploadFailed.value > 0 ? 'exception' : 'success';

    ElNotification.success({
      title: '上传完成',
      message: `成功上传 ${uploadCompleted.value} 个文件${uploadFailed.value > 0 ? `，失败 ${uploadFailed.value} 个` : ''}`
    });

    // 刷新数据
    await refreshDashboard();

  } finally {
    // 清空文件输入
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
};

const uploadSingleFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
};

const toggleSelection = (item) => {
  item.selected = !item.selected;
  if (item.selected) {
    selectedFiles.value.push(item);
  } else {
    const index = selectedFiles.value.findIndex(f => f.name === item.name);
    if (index > -1) {
      selectedFiles.value.splice(index, 1);
    }
  }
};

const clearSelection = () => {
  selectedFiles.value.forEach(item => {
    item.selected = false;
  });
  selectedFiles.value = [];
};

const copyUrl = async (item) => {
  const url = getFileUrl(item);
  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success('链接已复制到剪贴板');
  } catch (error) {
    ElMessage.error('复制失败，请手动复制');
  }
};

const deleteFile = async (item) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件 "${item.metadata.fileName}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await fetch(`./api/manage/delete/${item.name}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (response.ok) {
      const index = tableData.value.findIndex(f => f.name === item.name);
      if (index > -1) {
        tableData.value.splice(index, 1);
      }
      ElMessage.success('文件删除成功');
    } else {
      ElMessage.error('文件删除失败');
    }
  } catch (error) {
    // 用户取消删除
  }
};

const batchDelete = async () => {
  if (selectedFiles.value.length === 0) return;

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedFiles.value.length} 个文件吗？`,
      '批量删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const deletePromises = selectedFiles.value.map(item =>
      fetch(`./api/manage/delete/${item.name}`, {
        method: 'GET',
        credentials: 'include'
      })
    );

    await Promise.all(deletePromises);

    // 从列表中移除已删除的文件
    selectedFiles.value.forEach(item => {
      const index = tableData.value.findIndex(f => f.name === item.name);
      if (index > -1) {
        tableData.value.splice(index, 1);
      }
    });

    clearSelection();
    ElMessage.success('批量删除成功');
  } catch (error) {
    ElMessage.error('批量删除失败');
  }
};

const switchFileType = (type) => {
  fileType.value = type;
  currentPage.value = 1;
  localStorage.setItem('fileType', type);
};

const sort = (option) => {
  sortOption.value = option;
  localStorage.setItem('sortOption', option);
};

const handleSizeChange = (size) => {
  pageSize.value = size;
  currentPage.value = 1;
};

const handleCurrentChange = (page) => {
  currentPage.value = page;
};

const handleImageError = (event) => {
  event.target.style.display = 'none';
};

const updateStats = () => {
  // 更新各类型文件统计
  Object.keys(fileConfig).forEach(type => {
    if (type === 'document') {
      fileConfig[type].count = tableData.value.filter(item => {
        const ext = getFileExtension(item.name).toLowerCase();
        return !Object.values(fileConfig)
          .filter(config => config.exts.length > 0)
          .some(config => config.exts.includes(ext));
      }).length;
    } else {
      fileConfig[type].count = tableData.value.filter(item => {
        const ext = getFileExtension(item.name).toLowerCase();
        return fileConfig[type].exts.includes(ext);
      }).length;
    }
  });
};

// 生命周期
onMounted(async () => {
  // 检查登录状态
  try {
    const response = await fetch('./api/manage/check', {
      method: 'GET',
      credentials: 'include'
    });
    const result = await response.text();

    if (result !== 'true') {
      window.location.href = './api/manage/login';
      return;
    }
  } catch (error) {
    ElMessage.error('检查登录状态失败');
    return;
  }

  // 加载数据
  await refreshDashboard();

  // 恢复设置
  const savedSortOption = localStorage.getItem('sortOption');
  if (savedSortOption) {
    sortOption.value = savedSortOption;
  }

  const savedFileType = localStorage.getItem('fileType');
  if (savedFileType) {
    fileType.value = savedFileType;
  }
});

// 导出组件方法供外部使用
defineExpose({
  refreshDashboard,
  handleUpload,
  uploadFiles
});
</script>

<style scoped>
/* 样式将在下一个文件中定义 */
</style>
