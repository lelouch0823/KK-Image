// English Locale - Modular Index
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
import sales from './sales'; // New import
import trash from './trash'; // New import
import goodsOverview from './goodsOverview';
import purchaseOrder from './purchaseOrder';
import commandPalette from './commandPalette';

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
  sales,
  trash,
  goodsOverview,
  purchaseOrder,
  spaceManager: spaceModule.spaceManager,
  spacePublic: spaceModule.spacePublic,
  spaceAnalytics: spaceModule.spaceAnalytics,
  space: spaceModule.space,
  spaces: spaceModule.spaces,
  salesTab: spaceModule.salesTab,
  salesSpaces: spaceModule.salesSpaces,

  // Expanded from misc.js
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
  auditLogs: misc.auditLogs,
  outboxOps: misc.outboxOps,
  commandPalette,
};
