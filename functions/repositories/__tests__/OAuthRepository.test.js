import { describe, expect, it } from 'vitest';
import { OAuthRepository, hashSecret } from '../OAuthRepository.js';

const GUARD_ASSERTION_MARKER = "CASE WHEN changes() = 1 THEN '{}' ELSE 'not-json' END";

/**
 * 模拟 D1 batch 的顺序执行 + changes() 断言语义：
 * - UPDATE 语句记录 changes()；
 * - 紧随的断言语句（json_extract CASE changes()）在前一语句 changes() != 1 时抛
 *   "malformed JSON"，模拟真实 D1 的断言失败（整个 batch 回滚）；
 * - 抛错后后续语句（INSERT）不再执行。
 */
function createRotationDb({ tokenRows = [] } = {}) {
  const rows = tokenRows.map((row) => ({ ...row }));
  const insertedRows = [];
  let lastChanges = 0;
  const executedSql = [];

  const db = {
    prepare(sql) {
      const statement = {
        sql,
        params: [],
        bind(...params) {
          statement.params = params;
          return statement;
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
      };
      return statement;
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) {
        const sql = String(statement.sql);
        const params = statement.params || [];
        executedSql.push(sql);

        if (sql.startsWith('UPDATE oauth_tokens SET revoked')) {
          const [revokedAt, hashedValue, rawValue] = params;
          let changes = 0;
          for (const row of rows) {
            if (
              !row.revoked &&
              (row.refresh_token === hashedValue || row.refresh_token === rawValue)
            ) {
              row.revoked = 1;
              row.revoked_at = revokedAt;
              changes += 1;
            }
          }
          lastChanges = changes;
          results.push({ success: changes > 0, meta: { changes } });
          continue;
        }

        if (sql.includes(GUARD_ASSERTION_MARKER)) {
          if (lastChanges !== 1) {
            throw new Error(
              'Malformed JSON at position 0: JSON text malformed (changes() assertion failed)'
            );
          }
          results.push({ success: true, meta: {} });
          continue;
        }

        if (sql.startsWith('INSERT INTO oauth_tokens')) {
          const [id, accessToken, refreshToken, clientId, userId, scopes, expiresAt, refreshExpiresAt, createdAt] = params;
          insertedRows.push({
            id,
            access_token: accessToken,
            refresh_token: refreshToken,
            client_id: clientId,
            user_id: userId,
            scopes,
            expires_at: expiresAt,
            refresh_expires_at: refreshExpiresAt,
            created_at: createdAt,
          });
          lastChanges = 1;
          results.push({ success: true, meta: { changes: 1 } });
          continue;
        }

        throw new Error(`Unexpected SQL in batch: ${sql}`);
      }
      return results;
    },
  };

  return { db, rows, insertedRows, executedSql };
}

function buildRepo(db) {
  return new OAuthRepository(db, {
    now: () => 1710000000000,
    tokenIdFactory: () => 'oatok_new',
  });
}

const ROTATION_ARGS = {
  rawRefreshToken: 'ort_active-token',
  clientId: 'oc_client-1',
  userId: 'user-1',
  scopes: ['read'],
  newAccessToken: 'oat_next-access',
  newRefreshToken: 'ort_next-refresh',
};

describe('OAuthRepository.rotateRefreshToken', () => {
  it('commits rotation when the conditional revoke matches exactly one unrevoked row', async () => {
    const hashed = await hashSecret(ROTATION_ARGS.rawRefreshToken);
    const { db, rows, insertedRows } = createRotationDb({
      tokenRows: [{ id: 'tok-1', refresh_token: hashed, revoked: 0 }],
    });

    const result = await buildRepo(db).rotateRefreshToken(ROTATION_ARGS);

    expect(result.reuseDetected).toBe(false);
    expect(result.token).toEqual(
      expect.objectContaining({
        accessToken: 'oat_next-access',
        refreshToken: 'ort_next-refresh',
      })
    );
    // 旧令牌被吊销，新令牌行插入
    expect(rows[0].revoked).toBe(1);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].refresh_token).toBe(await hashSecret('ort_next-refresh'));
  });

  it('fails the concurrent loser without inserting a second active token row', async () => {
    // 模拟并发轮换：赢家的 batch 已提交（旧令牌 revoked=1），
    // 败者在同一令牌上重放 rotate —— 条件吊销命中 0 行，断言失败，整批回滚
    const hashed = await hashSecret(ROTATION_ARGS.rawRefreshToken);
    const { db, rows, insertedRows } = createRotationDb({
      tokenRows: [{ id: 'tok-1', refresh_token: hashed, revoked: 1, revoked_at: 1709999990000 }],
    });

    await expect(buildRepo(db).rotateRefreshToken(ROTATION_ARGS)).rejects.toThrow(
      /malformed json/i
    );

    // 关键断言：败者没有产生第二条活跃令牌行（INSERT 未执行）
    expect(insertedRows).toHaveLength(0);
    expect(rows).toHaveLength(1);
  });
});
