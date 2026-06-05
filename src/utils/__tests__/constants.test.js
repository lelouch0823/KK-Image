import { describe, it, expect } from 'vitest';
import { API_PREFIX, API, DEFAULT_PAGE_SIZE, ROUTES } from '../constants';

describe('constants', () => {
  describe('API_PREFIX', () => {
    it('应为 /api/manage', () => {
      expect(API_PREFIX).toBe('/api/manage');
    });
  });

  describe('DEFAULT_PAGE_SIZE', () => {
    it('应为 20', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(20);
    });
  });

  describe('API 对象', () => {
    it('应包含文件夹相关端点', () => {
      expect(API.FOLDERS).toBe('/api/manage/folders');
      expect(typeof API.FOLDER_BY_ID).toBe('function');
      expect(API.FOLDER_BY_ID(1)).toBe('/api/manage/folders/1');
    });

    it('应包含空间相关端点', () => {
      expect(API.SPACES).toBe('/api/manage/spaces');
      expect(typeof API.SPACE_BY_ID).toBe('function');
      expect(API.SPACE_BY_ID('abc')).toBe('/api/manage/spaces/abc');
      expect(API.SPACE_FILES(1)).toBe('/api/manage/spaces/1/files');
      expect(API.SPACE_STATS(1)).toBe('/api/manage/spaces/1/stats');
    });

    it('应包含管理端订单端点', () => {
      expect(API.MANAGE_ORDERS).toBe('/api/manage/orders');
      expect(API.MANAGE_ORDER_BY_ID(5)).toBe('/api/manage/orders/5');
      expect(API.MANAGE_ORDER_UPDATE(5)).toBe('/api/manage/orders/5');
      expect(API.MANAGE_ORDER_STATUS(5)).toBe('/api/manage/orders/5/status');
      expect(API.MANAGE_ORDER_EXPORT).toBe('/api/manage/orders/export');
    });

    it('应包含商品管理端点', () => {
      expect(API.MANAGE_PRODUCTS).toBe('/api/manage/products');
      expect(API.MANAGE_PRODUCT_BY_ID(3)).toBe('/api/manage/products/3');
    });

    it('应包含认证相关端点', () => {
      expect(API.LOGIN).toBe('/api/v1/auth/login');
      expect(API.LOGOUT).toBe('/api/v1/auth/logout');
      expect(API.USER).toBe('/api/v1/auth/me');
    });

    it('应包含销售端订单 API 端点函数', () => {
      expect(API.SALES_ORDER_LIST('tk123')).toBe('/api/sales/tk123/orders');
      expect(API.SALES_ORDER_CREATE('tk123')).toBe('/api/sales/tk123/orders');
      expect(API.SALES_ORDER_DETAIL('tk123', 7)).toBe('/api/sales/tk123/orders/7');
    });

    it('应包含回收站端点', () => {
      expect(API.TRASH).toBe('/api/manage/trash');
      expect(API.TRASH_RESTORE).toBe('/api/manage/trash/restore');
      expect(API.TRASH_DELETE).toBe('/api/manage/trash/delete');
      expect(API.TRASH_EMPTY).toBe('/api/manage/trash/empty');
    });

    it('应包含 AI 相关端点', () => {
      expect(API.AI.CHAT).toBe('/api/manage/ai/chat');
      expect(API.AI.STREAM).toBe('/api/manage/ai/stream');
      expect(API.AI.REPORT).toBe('/api/manage/ai/report');
    });

    it('应包含文件管理端点', () => {
      expect(API.FILES).toBe('/api/manage/files');
      expect(API.CHECK_HASH).toBe('/api/manage/files/check-hash');
    });
  });

  describe('ROUTES 对象', () => {
    it('应包含前端路由函数', () => {
      expect(ROUTES.GALLERY('tok')).toBe('/gallery/tok');
      expect(ROUTES.SPACE('tok')).toBe('/space/tok');
      expect(ROUTES.FILE(1)).toBe('/file/1');
      expect(ROUTES.SALES_PORTAL('tok')).toBe('/sales/tok');
      expect(ROUTES.ADMIN).toBe('/admin');
    });
  });
});
