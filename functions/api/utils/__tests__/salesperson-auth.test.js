import { describe, expect, it, vi, beforeEach } from 'vitest';

const authMocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
}));

vi.mock('../auth.js', async () => {
  const actual = await vi.importActual('../auth.js');
  return {
    ...actual,
    verifyJWT: authMocks.verifyJWT,
  };
});

import { authenticateSalesperson } from '../salesperson-auth.js';

function createEnv() {
  const db = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({
      id: 'sp-1',
      name: 'Alice',
      store: 'S1',
      is_active: 1,
    }),
  };
  return { DB: db, JWT_SECRET: 'test-secret' };
}

describe('authenticateSalesperson token parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts quoted sales_token cookie jwt', async () => {
    const env = createEnv();
    authMocks.verifyJWT.mockImplementation(async (token) => {
      if (token !== 'jwt.sales.cookie') {
        throw new Error(`unexpected token: ${token}`);
      }
      return { id: 'sp-1', type: 'salesperson' };
    });

    const req = new Request('https://example.com/api/sales/token-1/ping', {
      headers: {
        Cookie: 'sales_token="jwt.sales.cookie"',
      },
    });

    const salesperson = await authenticateSalesperson(req, env, 'token-1');
    expect(salesperson.id).toBe('sp-1');
    expect(authMocks.verifyJWT).toHaveBeenCalledWith('jwt.sales.cookie', env);
  });

  it('accepts quoted bearer jwt when cookie is absent', async () => {
    const env = createEnv();
    authMocks.verifyJWT.mockImplementation(async (token) => {
      if (token !== 'jwt.sales.bearer') {
        throw new Error(`unexpected token: ${token}`);
      }
      return { id: 'sp-1', type: 'salesperson' };
    });

    const req = new Request('https://example.com/api/sales/token-1/ping', {
      headers: {
        Authorization: 'Bearer "jwt.sales.bearer"',
      },
    });

    const salesperson = await authenticateSalesperson(req, env, 'token-1');
    expect(salesperson.id).toBe('sp-1');
    expect(authMocks.verifyJWT).toHaveBeenCalledWith('jwt.sales.bearer', env);
  });
});
