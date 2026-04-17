import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/utils/id.js', async () => {
  const actual = await vi.importActual('../../api/utils/id.js');
  return {
    ...actual,
    generateId: vi.fn(),
    generateShareToken: vi.fn(),
    hashPassword: vi.fn(),
    now: vi.fn(),
  };
});

import { SalespersonRepository } from '../SalespersonRepository.js';
import { generateId, generateShareToken, hashPassword, now } from '../../api/utils/id.js';

function createStatement(sql, options = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => null),
    all: vi.fn(async () => ({ results: [] })),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };

  if ('firstResult' in options) {
    statement.first.mockResolvedValue(options.firstResult);
  }
  if ('allResult' in options) {
    statement.all.mockResolvedValue(options.allResult);
  }
  if ('runResult' in options) {
    statement.run.mockResolvedValue(options.runResult);
  }

  return statement;
}

describe('SalespersonRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(generateId).mockReturnValue('sales-1');
    vi.mocked(generateShareToken).mockReturnValue('share-token-1');
    vi.mocked(hashPassword).mockResolvedValue('hashed-password');
    vi.mocked(now).mockReturnValue(1700000000000);
  });

  it('finds records by id, token, and wechat openid', async () => {
    const byId = createStatement('by-id', { firstResult: { id: 'sales-1' } });
    const byToken = createStatement('by-token', { firstResult: { access_token: 'token-1' } });
    const byOpenid = createStatement('by-openid', { firstResult: { wechat_openid: 'openid-1' } });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(byId)
        .mockReturnValueOnce(byToken)
        .mockReturnValueOnce(byOpenid),
    };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.findById('sales-1')).resolves.toEqual({ id: 'sales-1' });
    await expect(repo.findByToken('token-1')).resolves.toEqual({ access_token: 'token-1' });
    await expect(repo.findByWechatOpenid('openid-1')).resolves.toEqual({ wechat_openid: 'openid-1' });

    expect(byId.bind).toHaveBeenCalledWith('sales-1');
    expect(byToken.bind).toHaveBeenCalledWith('token-1');
    expect(byOpenid.bind).toHaveBeenCalledWith('openid-1');
  });

  it('updates wechat openid and returns true when rows change', async () => {
    const statement = createStatement('update-openid', {
      runResult: { success: true, meta: { changes: 1 } },
    });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.updateWechatOpenid('sales-1', 'openid-1')).resolves.toBe(true);
    expect(statement.bind).toHaveBeenCalledWith('openid-1', 1700000000000, 'sales-1');
  });

  it('falls back to existence check when updating wechat openid is a no-op', async () => {
    const updateStatement = createStatement('update-openid', {
      runResult: { success: true, meta: { changes: 0 } },
    });
    const existsStatement = createStatement('find-existing', {
      firstResult: { id: 'sales-1' },
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(updateStatement)
        .mockReturnValueOnce(existsStatement),
    };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.updateWechatOpenid('sales-1', 'openid-1')).resolves.toBe(true);
    expect(existsStatement.bind).toHaveBeenCalledWith('sales-1');
  });

  it('returns false when no salesperson exists after openid update no-op', async () => {
    const updateStatement = createStatement('update-openid', {
      runResult: { success: true, meta: { changes: 0 } },
    });
    const existsStatement = createStatement('find-existing', {
      firstResult: null,
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(updateStatement)
        .mockReturnValueOnce(existsStatement),
    };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.updateWechatOpenid('sales-404', 'openid-1')).resolves.toBe(false);
  });

  it('lists salespersons with search filters and derived page count', async () => {
    const countStatement = createStatement('count', {
      firstResult: { total: 3 },
    });
    const listStatement = createStatement('list', {
      allResult: {
        results: [{ id: 'sales-1', order_count: 4 }],
      },
    });
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('COUNT(*) as total')) return countStatement;
        return listStatement;
      }),
    };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    const value = await repo.list({ page: '2', limit: '1', search: 'bob' });

    expect(countStatement.bind).toHaveBeenCalledWith('%bob%', '%bob%', '%bob%');
    expect(listStatement.bind).toHaveBeenCalledWith('%bob%', '%bob%', '%bob%', 1, 1);
    expect(value).toEqual({
      results: [{ id: 'sales-1', order_count: 4 }],
      total: 3,
      pages: 3,
    });
  });

  it('creates a salesperson with generated identifiers and hashed password', async () => {
    const statement = createStatement('create');
    const db = { prepare: vi.fn(() => statement) };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    const value = await repo.create({
      name: '  Bob  ',
      store: '旗舰店',
      phone: '13800000000',
      password: 'secret',
    });

    expect(vi.mocked(generateId)).toHaveBeenCalled();
    expect(vi.mocked(generateShareToken)).toHaveBeenCalledWith(12);
    expect(vi.mocked(hashPassword)).toHaveBeenCalledWith('secret', 'jwt-secret');
    expect(statement.bind).toHaveBeenCalledWith(
      'sales-1',
      'Bob',
      '旗舰店',
      '13800000000',
      'share-token-1',
      'hashed-password',
      1700000000000,
      1700000000000
    );
    expect(value).toEqual({
      id: 'sales-1',
      name: 'Bob',
      store: '旗舰店',
      phone: '13800000000',
      accessToken: 'share-token-1',
      accessUrl: '/order/share-token-1',
    });
  });

  it('retries salesperson creation on transient unique constraint failures', async () => {
    const statement = createStatement('create');
    statement.run
      .mockRejectedValueOnce(new Error('UNIQUE constraint failed: salespersons.access_token'))
      .mockResolvedValueOnce({ success: true, meta: { changes: 1 } });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.create({ name: 'Alice', password: 'secret' })).resolves.toMatchObject({
      id: 'sales-1',
      accessToken: 'share-token-1',
    });
    expect(statement.run).toHaveBeenCalledTimes(2);
  });

  it('throws creation errors when retries are not allowed to recover', async () => {
    const statement = createStatement('create');
    statement.run.mockRejectedValue(new Error('database offline'));
    const db = { prepare: vi.fn(() => statement) };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.create({ name: 'Alice', password: 'secret' })).rejects.toThrow('database offline');
    expect(statement.run).toHaveBeenCalledTimes(1);
  });

  it('returns false when update receives no mutable fields', async () => {
    const db = { prepare: vi.fn() };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.update('sales-1', {})).resolves.toBe(false);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('updates salesperson fields including hashed password and active flag', async () => {
    const statement = createStatement('update', {
      runResult: { success: true, meta: { changes: 1 } },
    });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.update('sales-1', {
      name: '  Alice  ',
      store: '',
      phone: '13900000000',
      password: 'new-secret',
      isActive: false,
    })).resolves.toBe(true);

    expect(vi.mocked(hashPassword)).toHaveBeenCalledWith('new-secret', 'jwt-secret');
    expect(db.prepare.mock.calls[0][0]).toContain('UPDATE salespersons SET');
    expect(statement.bind).toHaveBeenCalledWith(
      0,
      'Alice',
      'hashed-password',
      '13900000000',
      null,
      1700000000000,
      'sales-1'
    );
  });

  it('returns false when update is a no-op and record is missing', async () => {
    const updateStatement = createStatement('update', {
      runResult: { success: true, meta: { changes: 0 } },
    });
    const existsStatement = createStatement('find-existing', {
      firstResult: null,
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(updateStatement)
        .mockReturnValueOnce(existsStatement),
    };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.update('sales-404', { phone: '138' })).resolves.toBe(false);
    expect(existsStatement.bind).toHaveBeenCalledWith('sales-404');
  });

  it('deletes salespersons based on D1 change count', async () => {
    const deleted = createStatement('delete-ok', {
      runResult: { success: true, meta: { changes: 1 } },
    });
    const missed = createStatement('delete-missed', {
      runResult: { success: true, meta: { changes: 0 } },
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(deleted)
        .mockReturnValueOnce(missed),
    };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.delete('sales-1')).resolves.toBe(true);
    await expect(repo.delete('sales-404')).resolves.toBe(false);
  });

  it('resets access token and throws when target record is missing', async () => {
    const resetOk = createStatement('reset-token-ok', {
      runResult: { success: true, meta: { changes: 1 } },
    });
    const resetMissing = createStatement('reset-token-missing', {
      runResult: { success: true, meta: { changes: 0 } },
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(resetOk)
        .mockReturnValueOnce(resetMissing),
    };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.resetAccessToken('sales-1')).resolves.toBe('share-token-1');
    await expect(repo.resetAccessToken('sales-404')).rejects.toThrow('Salesperson not found');
    expect(resetOk.bind).toHaveBeenCalledWith('share-token-1', 1700000000000, 'sales-1');
  });

  it('reports whether a salesperson has related orders', async () => {
    const exists = createStatement('has-orders', { firstResult: { count: 2 } });
    const missing = createStatement('has-orders-none', { firstResult: { count: 0 } });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(exists)
        .mockReturnValueOnce(missing),
    };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.hasOrders('sales-1')).resolves.toBe(true);
    await expect(repo.hasOrders('sales-2')).resolves.toBe(false);
  });

  it('records login metadata and forwards nullable device fields', async () => {
    const statement = createStatement('record-login', {
      runResult: { success: true, meta: { changes: 1 } },
    });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new SalespersonRepository(db, 'jwt-secret');

    await expect(repo.recordLogin('sales-1', '', undefined)).resolves.toBe(true);
    expect(statement.bind).toHaveBeenCalledWith(1700000000000, null, null, 1700000000000, 'sales-1');
  });
});
