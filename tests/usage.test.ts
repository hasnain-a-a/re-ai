import { describe, it, expect } from 'vitest';
import { getAiUsage } from '../src/core/usage.js';

function fakePool(total: number) {
  const calls: { sql: string; params: unknown[] }[] = [];
  return {
    calls,
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return { rows: sql.includes('COUNT(*)::int AS sessions,\n') ? [{ sessions: total }] : [] };
    },
  };
}

describe('getAiUsage', () => {
  it('clamps filters and passes a NULL provider when unfiltered', async () => {
    const pool = fakePool(120);
    const res = await getAiUsage(pool, { days: '9999', page: '3', pageSize: '500' });

    expect(pool.calls[0].params).toEqual([365, null]);
    expect(pool.calls[3].params).toEqual([365, null, 100, 200]);
    expect(res.pagination).toEqual({ total: 120, page: 3, pageSize: 100, totalPages: 2 });
  });

  it('filters by provider and defaults bad input', async () => {
    const pool = fakePool(0);
    const res = await getAiUsage(pool, { days: 'abc', provider: ' anthropic ', page: '-4' });

    expect(pool.calls[0].params).toEqual([30, 'anthropic']);
    expect(pool.calls[3].params).toEqual([30, 'anthropic', 25, 0]);
    expect(res.pagination.totalPages).toBe(1);
  });
});
