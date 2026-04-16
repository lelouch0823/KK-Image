import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execute, query, queryFirst } from '../query.js';

function createPreparedStatement() {
  const statement = {
    bind: vi.fn(() => statement),
    all: vi.fn(),
    first: vi.fn(),
    run: vi.fn(),
  };

  return statement;
}

function createMockDb() {
  const statements = [];
  const db = {
    prepare: vi.fn(() => {
      const statement = createPreparedStatement();
      statements.push(statement);
      return statement;
    }),
  };

  return { db, statements };
}

describe('query observability', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches non-enumerable perf metadata and emits a uniform metric contract', async () => {
    const { db, statements } = createMockDb();
    const metrics = [];

    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      now += 5;
      return now;
    });

    db.prepare.mockImplementationOnce(() => {
      const statement = createPreparedStatement();
      statement.all.mockResolvedValue({
        results: [{ id: 'p-1' }],
        meta: { rows_read: 4, rows_written: 0 },
      });
      statements.push(statement);
      return statement;
    });
    const listResult = await query(db, 'SELECT * FROM products WHERE id = ?', ['p-1'], {
      label: 'product.search.list',
      onPerf: (metric) => metrics.push(metric),
    });
    expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM products WHERE id = ?');

    db.prepare.mockImplementationOnce(() => {
      const statement = createPreparedStatement();
      statement.first.mockResolvedValue({ total: 1 });
      statements.push(statement);
      return statement;
    });
    const firstResult = await queryFirst(db, 'SELECT * FROM products WHERE id = ?', ['p-1'], {
      label: 'product.search.count',
      onPerf: (metric) => metrics.push(metric),
    });

    db.prepare.mockImplementationOnce(() => {
      const statement = createPreparedStatement();
      statement.run.mockResolvedValue({
        success: true,
        meta: { rows_read: 1, rows_written: 1, changes: 1 },
      });
      statements.push(statement);
      return statement;
    });
    const writeResult = await execute(db, 'UPDATE products SET name = ? WHERE id = ?', ['Updated', 'p-1'], {
      label: 'product.update',
      onPerf: (metric) => metrics.push(metric),
    });

    expect(Object.keys(listResult)).toEqual(['results', 'meta']);
    expect(listResult._perf).toMatchObject({
      label: 'product.search.list',
      operation: 'query',
      rowsRead: 4,
      rowsWritten: 0,
    });

    expect(Object.keys(firstResult)).toEqual(['total']);
    expect(firstResult._perf).toMatchObject({
      label: 'product.search.count',
      operation: 'queryFirst',
      rowsRead: null,
      rowsWritten: null,
    });

    expect(Object.keys(writeResult)).toEqual(['success', 'meta']);
    expect(writeResult._perf).toMatchObject({
      label: 'product.update',
      operation: 'execute',
      rowsRead: 1,
      rowsWritten: 1,
    });

    expect(metrics).toHaveLength(3);
    expect(metrics.map((metric) => metric.label)).toEqual([
      'product.search.list',
      'product.search.count',
      'product.update',
    ]);
    expect(metrics.map((metric) => metric.operation)).toEqual(['query', 'queryFirst', 'execute']);
  });
});
