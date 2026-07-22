import { describe, expect, it, vi } from 'vitest';
import { PlexIdentityDesyncHealthCheck } from './PlexIdentityDesyncHealthCheck.ts';

describe('PlexIdentityDesyncHealthCheck', () => {
  it('returns healthy when no missing programs in lineups', async () => {
    const db = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ count: 0 }),
    };

    const check = new PlexIdentityDesyncHealthCheck(db as never);
    const result = await check.getStatus();
    expect(result.type).toBe('healthy');
  });

  it('warns when channel lineups reference missing programs', async () => {
    const db = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ count: 3 }),
    };

    const check = new PlexIdentityDesyncHealthCheck(db as never);
    const result = await check.getStatus();
    expect(result.type).toBe('warning');
    if (result.type === 'warning') {
      expect(result.context).toContain('3');
    }
  });
});
