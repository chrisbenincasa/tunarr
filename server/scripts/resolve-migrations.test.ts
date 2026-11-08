import { describe, expect, test } from 'vitest';
import { entryRegex } from './resolve-migrations.ts';

function registry(entries: string[]): string {
  return [
    '      {',
    ...entries,
    '      } satisfies Record<string, TunarrDatabaseMigration>,',
  ].join('\n');
}

const base = registry([
  '        migration1769361518: makeMigrationFromSqlFile(',
  "          './sql/0040_daffy_bishop.sql',",
  '          true,',
  '        ),',
]);

describe('entryRegex', () => {
  test('strips an entry registered with makeMigrationFromSqlFile', () => {
    const ours = registry([
      '        migration1769361518: makeMigrationFromSqlFile(',
      "          './sql/0040_daffy_bishop.sql',",
      '          true,',
      '        ),',
      '        migration1793564678: makeMigrationFromSqlFile(',
      "          './sql/0041_ours.sql',",
      '        ),',
    ]);

    expect(ours.replace(entryRegex('0041_ours'), '')).toBe(base);
  });

  test('strips an entry registered with the older makeKyselyMigrationFromSqlFile', () => {
    const ours = registry([
      '        migration1769361518: makeMigrationFromSqlFile(',
      "          './sql/0040_daffy_bishop.sql',",
      '          true,',
      '        ),',
      '        migration1793564678: makeKyselyMigrationFromSqlFile(',
      "          './sql/0041_ours.sql',",
      '        ),',
    ]);

    expect(ours.replace(entryRegex('0041_ours'), '')).toBe(base);
  });

  test('captures fullCopy for either helper name', () => {
    for (const helper of [
      'makeMigrationFromSqlFile',
      'makeKyselyMigrationFromSqlFile',
    ]) {
      const ours = registry([
        `        migration1793564678: ${helper}(`,
        "          './sql/0041_ours.sql',",
        '          true,',
        '        ),',
      ]);

      expect(entryRegex('0041_ours').exec(ours)?.[1]).toBe('true');
    }
  });

  test('removes comment lines directly above the entry', () => {
    const ours = registry([
      '        migration1769361518: makeMigrationFromSqlFile(',
      "          './sql/0040_daffy_bishop.sql',",
      '          true,',
      '        ),',
      '        // Adds the ours table',
      '        migration1793564678: makeKyselyMigrationFromSqlFile(',
      "          './sql/0041_ours.sql',",
      '        ),',
    ]);

    expect(ours.replace(entryRegex('0041_ours'), '')).toBe(base);
  });

  test('strips an entry under a named key', () => {
    for (const helper of [
      'makeMigrationFromSqlFile',
      'makeKyselyMigrationFromSqlFile',
    ]) {
      const ours = registry([
        '        migration1769361518: makeMigrationFromSqlFile(',
        "          './sql/0040_daffy_bishop.sql',",
        '          true,',
        '        ),',
        '        migration1764710105_AddGenreAndStudios:',
        `          ${helper}('./sql/0041_ours.sql'),`,
      ]);

      expect(ours.replace(entryRegex('0041_ours'), '')).toBe(base);
    }
  });

  test('does not match a different tag', () => {
    expect(entryRegex('0041_ours').test(base)).toBe(false);
  });
});
