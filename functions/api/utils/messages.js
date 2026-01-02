/**
 * 后端 API 统一消息常量
 * 包含错误提示、成功反馈及权限文案
 */

export const MSG = {
  // 认证与权限
  AUTH: {
    REQUIRED: '请先登录以访问此资源',
    EXPIRED: '登录已过期，请重新登录',
    FORBIDDEN: '权限不足',
    INVALID_CREDENTIALS: '用户名或密码错误',
    VERIFY_FAILED: '人机验证失败',
    VERIFY_SKIPPED: '验证已跳过',
    VERIFY_SUCCESS: '验证通过',
    VERIFY_ERROR: '验证服务错误',
    MISSING_TOKEN: '缺少验证令牌',
    UNCONFIGURED: '认证未配置',
    USERNAME_EXISTS: '用户名已存在',
    CANNOT_DELETE_SELF: '不能删除自己的账户',
    LOGIN_SUCCESS: '登录成功',
  },

  // 资源状态
  FILE: {
    NOT_FOUND: '文件不存在',
    ALREADY_EXISTS: '文件已存在',
    RENAME_SUCCESS: '文件已重命名',
    DELETE_SUCCESS: '文件已删除',
    BATCH_DELETE_SUCCESS: '已删除 {count} 个文件',
    MOVE_SUCCESS: '已移动 {count} 个文件',
    UPDATE_SUCCESS: '文件已更新',
    NAME_REQUIRED: '文件名不能为空',
    NAME_TOO_LONG: '文件名过长',
    SELECT_FILE: '请选择要上传的文件',
    INVALID_TYPE: '仅支持 JPG、PNG、GIF、WebP 格式',
    SIZE_LIMIT: '文件大小不能超过 10MB',
    UPLOAD_SUCCESS: '上传成功',
    INSTANT_UPLOAD: '秒传成功',
  },

  FOLDER: {
    NOT_FOUND: '文件夹不存在',
    EMPTY_INVALID: '文件夹不为空，请先删除其中的文件和子文件夹',
    PARENT_NOT_FOUND: '父文件夹不存在',
    CREATE_SUCCESS: '文件夹创建成功',
    DELETE_SUCCESS: '文件夹已删除',
    ROOT_CANNOT_DELETE: '不能删除根文件夹',
    MOVE_TO_SELF: '不能将文件夹移动到自身',
    UPDATE_SUCCESS: '文件夹已更新',
    NAME_REQUIRED: '文件夹名不能为空',
    NAME_TOO_LONG: '文件夹名过长',
  },

  ALBUM: {
    NOT_FOUND: '相册不存在',
    CREATE_SUCCESS: '创建相册成功',
    UPDATE_SUCCESS: '相册已更新',
    DELETE_SUCCESS: '相册已删除',
    ADD_FILES_SUCCESS: '已添加 {count} 个文件到相册',
    REMOVE_FILES_SUCCESS: '已从相册移除 {count} 个文件',
  },

  SPACE: {
    NOT_FOUND: '共享空间不存在',
    CREATE_SUCCESS: '创建共享空间成功',
    UPDATE_SUCCESS: '共享空间已更新',
    DELETE_SUCCESS: '共享空间已删除',
    ADD_FILES_SUCCESS: '已添加 {count} 个文件到空间',
    REMOVE_FILES_SUCCESS: '已从空间移除 {count} 个文件',
    PUBLIC_REQUIRED: '该空间未公开',
    PRIVATE: '该空间未公开分享',
    PASSWORD_REQUIRED: '该空间需要密码',
    LINK_INVALID: '空间不存在或链接已失效',
    LINK_EXPIRED: '分享链接已过期',
    EXPIRED: '分享链接已过期',
  },

  USER: {
    NOT_FOUND: '用户不存在',
    CREATE_SUCCESS: '创建用户成功',
    UPDATE_SUCCESS: '更新用户成功',
    DELETE_SUCCESS: '用户已删除',
    NAME_REQUIRED: '用户名不能为空',
    PASSWORD_REQUIRED: '密码不能为空',
    INVALID_CHARS: '用户名只能包含字母、数字和下划线',
  },

  WEBHOOK: {
    NOT_FOUND: 'Webhook 不存在',
    CREATE_SUCCESS: '创建 Webhook 成功',
    UPDATE_SUCCESS: '更新 Webhook 成功',
    DELETE_SUCCESS: 'Webhook 已删除',
  },

  // 销售人员管理
  SALESPERSON: {
    NOT_FOUND: '销售人员不存在',
    CREATE_SUCCESS: '销售人员创建成功',
    UPDATE_SUCCESS: '销售人员信息已更新',
    DELETE_SUCCESS: '销售人员已删除',
    TOKEN_RESET: '访问链接已重置',
    DISABLED: '该账户已被禁用',
    ENABLED: '该账户已启用',
    INVALID_PASSWORD: '密码错误',
    PASSWORD_REQUIRED: '请输入密码',
    NAME_REQUIRED: '销售姓名不能为空',
    TOKEN_CONFLICT: '访问令牌冲突，请重试',
    HAS_ORDERS: '该销售人员有关联订单，无法删除',
  },

  // 客户管理
  CUSTOMER: {
    CANNOT_DELETE_HAS_ORDERS: '无法删除：该客户有关联订单',
  },

  // 订单管理
  ORDER: {
    NOT_FOUND: '订单不存在',
    CREATE_SUCCESS: '预定申请提交成功',
    UPDATE_SUCCESS: '订单已更新',
    DELETE_SUCCESS: '订单已删除',
    STATUS_CHANGED: '订单状态已更新',
    STATUS_UNCHANGED: '状态未变更',
    REASON_REQUIRED: '为了便于追溯，请填写修改理由',
    COMMENT_ADDED: '留言已添加',
    ALREADY_READ: '已标记为已读',
    INVALID_STATUS: '无效的订单状态',
    NO_PERMISSION: '无权访问此订单',
    NAME_REQUIRED: '商品名称不能为空',
    ONLY_PENDING_CAN_EDIT: '只能修改待确认、已驳回或已作废的订单',
    ONLY_PENDING_CAN_VOID: '只能作废待确认状态的订单',
    REASON_SALES_EDIT: '销售端发起的修改',
    REASON_SALES_VOID: '销售端发起的作废',
    REASON_RESUBMIT: '修改后重新提交',
    VOID_SUCCESS: '订单已作废',
    BATCH_LIMIT: '批量操作最多支持 100 条订单',
    BATCH_NO_VALID: '没有可以执行此操作的订单',
    IMAGES: '张图片',
  },

  // 通用错误
  COMMON: {
    LOAD_FAILED: '获取数据失败',
    CREATE_FAILED: '创建失败',
    UPDATE_FAILED: '更新失败',
    DELETE_FAILED: '删除失败',
    OP_FAILED: '操作失败',
    NETWORK_ERROR: '网络错误',
    INVALID_PARAMS: '请求信息有误',
    NO_UPDATE_FIELDS: '未检测到信息变更',
    UPLOAD_FAILED: '上传失败',
    UPLOAD_NO_FILE: '未找到上传文件',
    CHECK_FAILED: '检查失败',
  },

  // 权限列表描述
  PERMISSIONS: {
    'files:read': '读取文件',
    'files:write': '创建/编辑文件',
    'files:delete': '删除文件',
    'folders:read': '读取文件夹',
    'folders:write': '创建/编辑文件夹',
    'folders:delete': '删除文件夹',
    'users:read': '查看用户',
    'users:write': '管理用户',
    'webhooks:read': '查看 Webhooks',
    'webhooks:write': '管理 Webhooks',
    'stats:read': '查看统计',
    'admin:full': '完全管理员权限',
  },

  ROLES: {
    ADMIN: '管理员',
    USER: '普通用户',
    GUEST: '访客',
  },
};
