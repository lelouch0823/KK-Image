// 中文翻译 - 模块化入口
// 合并所有模块导出

import common from './common';
import formatters from './formatters';
import upload from './upload';
import auth from './auth';
import fileManager from './fileManager';
import dashboard from './dashboard';
import stats from './stats';
import spaceModule from './space';
import order from './order';
import product from './product';
import salesperson from './salesperson';
import settings from './settings';
import gallery from './gallery';
import customer from './customer';
import misc from './misc';

export default {
  common,
  formatters,
  upload,
  fileManager,
  dashboard,
  stats,
  gallery,
  order,
  product,
  salesperson,
  settings,
  customer,
  auth,

  // 从 space.js 展开
  spaceManager: spaceModule.spaceManager,
  spacePublic: spaceModule.spacePublic,
  spaceAnalytics: spaceModule.spaceAnalytics,
  space: spaceModule.space,
  spaces: spaceModule.spaces,

  // 从 misc.js 展开
  share: misc.share,
  fileSelector: misc.fileSelector,
  moveFile: misc.moveFile,
  header: misc.header,
  sidebar: misc.sidebar,
  views: misc.views,
  fileOps: misc.fileOps,
  uploadQueue: misc.uploadQueue,
  batchDownload: misc.batchDownload,
  notification: misc.notification,
  search: misc.search,
  router: misc.router,
  pwa: misc.pwa,
  salesStats: misc.salesStats,
  ai: misc.ai,
};
