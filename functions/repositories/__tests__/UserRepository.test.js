import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRepository } from '../UserRepository.js';

/** 创建语句 mock（含 first/all/run） */
function createStatement(overrides = {}) {
  const statement = {
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => null),
    all: vi.fn(async () => ({ results: [] })),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    ...overrides,
  };
  return statement;
}

describe('UserRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // findById
  // ==========================================
  describe('findById', () => {
    it('返回用户信息（不含密码哈希）', async () => {
      const stmt = createStatement({
        first: vi.fn(async () => ({
          id: 'user-1',
          username: 'admin',
          name: '管理员',
          email: 'admin@test.com',
          role: 'admin',
          permissions: '["*"]',
          created_at: 1000,
          updated_at: 2000,
        })),
      });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      const result = await repo.findById('user-1');

      expect(result).not.toBeNull();
      expect(result.id).toBe('user-1');
      expect(result.username).toBe('admin');
      expect(result.role).toBe('admin');
      expect(db.prepare.mock.calls[0][0]).toContain('SELECT');
      expect(db.prepare.mock.calls[0][0]).not.toContain('password_hash');
      expect(stmt.bind).toHaveBeenCalledWith('user-1');
    });

    it('用户不存在时返回 null', async () => {
      const stmt = createStatement({ first: vi.fn(async () => null) });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // findByUsername
  // ==========================================
  describe('findByUsername', () => {
    it('返回 id、username 和 password_hash', async () => {
      const stmt = createStatement({
        first: vi.fn(async () => ({
          id: 'user-1',
          username: 'admin',
          password_hash: 'hashed-pw',
        })),
      });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      const result = await repo.findByUsername('admin');

      expect(result).not.toBeNull();
      expect(result.id).toBe('user-1');
      expect(result.password_hash).toBe('hashed-pw');
      expect(db.prepare.mock.calls[0][0]).toContain('password_hash');
      expect(stmt.bind).toHaveBeenCalledWith('admin');
    });

    it('用户名不存在时返回 null', async () => {
      const stmt = createStatement({ first: vi.fn(async () => null) });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      const result = await repo.findByUsername('nobody');

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // findByUsernameForAuth
  // ==========================================
  describe('findByUsernameForAuth', () => {
    it('返回认证所需字段（含角色和权限）', async () => {
      const stmt = createStatement({
        first: vi.fn(async () => ({
          id: 'user-1',
          password_hash: 'hashed-pw',
          name: '管理员',
          role: 'admin',
          permissions: '["orders:read","orders:write"]',
        })),
      });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      const result = await repo.findByUsernameForAuth('admin');

      expect(result).not.toBeNull();
      expect(result.role).toBe('admin');
      expect(result.permissions).toBe('["orders:read","orders:write"]');
      const sql = db.prepare.mock.calls[0][0];
      expect(sql).toContain('password_hash');
      expect(sql).toContain('role');
      expect(sql).toContain('permissions');
    });
  });

  // ==========================================
  // create
  // ==========================================
  describe('create', () => {
    it('插入用户记录（含所有字段）', async () => {
      const now = 1710000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      await repo.create({
        id: 'user-1',
        username: 'newuser',
        passwordHash: 'hashed-pw',
        name: '新用户',
        email: 'new@test.com',
        role: 'user',
        permissions: '["orders:read"]',
        createdAt: 1000,
      });

      expect(db.prepare.mock.calls[0][0]).toContain('INSERT INTO users');
      expect(stmt.params).toEqual([
        'user-1', 'newuser', 'hashed-pw', '新用户', 'new@test.com',
        'user', '["orders:read"]', 1000,
      ]);
    });

    it('可选字段使用默认值', async () => {
      const now = 1710000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      await repo.create({
        id: 'user-2',
        username: 'minimal',
        passwordHash: 'pw',
      });

      expect(stmt.params).toEqual([
        'user-2', 'minimal', 'pw', null, null, 'user', '[]', now,
      ]);
    });
  });

  // ==========================================
  // update
  // ==========================================
  describe('update', () => {
    it('更新允许的字段', async () => {
      const now = 1710000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      await repo.update('user-1', { name: '新名字', email: 'new@test.com' });

      expect(db.prepare.mock.calls[0][0]).toContain('UPDATE users SET');
      expect(db.prepare.mock.calls[0][0]).toContain('WHERE id = ?');
      // buildSetClause 按 key 排序: email, name, updated_at
      expect(stmt.params).toEqual(['new@test.com', '新名字', now, 'user-1']);
    });

    it('忽略不在白名单中的字段', async () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      await repo.update('user-1', { id: 'hacked', role: 'superadmin', unknownField: 'x' });

      // 仅 role 在白名单中（id 不在白名单中）
      expect(db.prepare).toHaveBeenCalled();
      const params = stmt.params;
      expect(params).toContain('superadmin');
      expect(params).not.toContain('hacked');
    });

    it('无有效字段时不执行更新', async () => {
      const db = { prepare: vi.fn() };
      const repo = new UserRepository(db);

      await repo.update('user-1', { unknownField: 'value' });

      expect(db.prepare).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // delete
  // ==========================================
  describe('delete', () => {
    it('按 ID 删除用户', async () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new UserRepository(db);

      await repo.delete('user-1');

      expect(db.prepare.mock.calls[0][0]).toBe('DELETE FROM users WHERE id = ?');
      expect(stmt.params).toEqual(['user-1']);
      expect(stmt.run).toHaveBeenCalled();
    });
  });

  // ==========================================
  // ping（静态方法）
  // ==========================================
  describe('ping', () => {
    it('数据库可达时返回 true', async () => {
      const stmt = createStatement({ first: vi.fn(async () => ({ '1': 1 })) });
      const db = { prepare: vi.fn(() => stmt) };

      const result = await UserRepository.ping(db);

      expect(result).toBe(true);
      expect(db.prepare).toHaveBeenCalledWith('SELECT 1');
    });

    it('数据库不可达时返回 false', async () => {
      const stmt = createStatement({ first: vi.fn(async () => { throw new Error('DB unavailable'); }) });
      const db = { prepare: vi.fn(() => stmt) };

      const result = await UserRepository.ping(db);

      expect(result).toBe(false);
    });
  });
});
