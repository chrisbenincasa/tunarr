import { FileBackupOutputSchema } from '@tunarr/types/schemas';

describe('FileBackupOutputSchema', () => {
  const base = { type: 'file', outputPath: '/backups' } as const;

  test('accepts 0 for maxBackups, which disables pruning', () => {
    expect(
      FileBackupOutputSchema.safeParse({ ...base, maxBackups: 0 }).success,
    ).toBe(true);
  });

  test('rejects negative maxBackups', () => {
    expect(
      FileBackupOutputSchema.safeParse({ ...base, maxBackups: -1 }).success,
    ).toBe(false);
  });
});
