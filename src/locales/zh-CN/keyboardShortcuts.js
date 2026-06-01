// 键盘快捷键
export default {
  title: '键盘快捷键',
  description: '查看所有可用的键盘快捷键',
  category: {
    general: '通用',
    navigation: '导航',
    actions: '操作',
    editing: '编辑',
  },
  shortcuts: {
    toggleHelp: '显示/隐藏快捷键帮助',
    commandPalette: '打开命令面板',
    newOrder: '新建订单',
    newProduct: '新建商品',
    focusSearch: '聚焦搜索框',
    closeModal: '关闭弹窗/覆盖层',
  },
  hints: {
    pressKey: '按下',
    toTrigger: '触发',
  },
  // 修饰键显示名
  modifiers: {
    mod: '⌘',  // Mac 上显示 ⌘，可后续根据平台动态切换
    ctrl: 'Ctrl',
    shift: 'Shift',
    alt: 'Alt',
  },
};
