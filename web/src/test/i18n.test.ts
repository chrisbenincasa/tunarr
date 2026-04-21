import { i18n } from '@lingui/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadCatalog } from '../i18n.ts';

describe('loadCatalog', () => {
  beforeEach(() => {
    // Reset to a known state before each test
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  it('activates the English locale', async () => {
    await loadCatalog('en');
    expect(i18n.locale).toBe('en');
  });

  it('is idempotent — loading the same locale twice does not error', async () => {
    await loadCatalog('en');
    await expect(loadCatalog('en')).resolves.toBeUndefined();
    expect(i18n.locale).toBe('en');
  });

  it('falls back to English when given a nonexistent locale', async () => {
    await loadCatalog('nonexistent-LOCALE');
    expect(i18n.locale).toBe('en');
  });

  it('activates Spanish locale', async () => {
    await loadCatalog('es');
    expect(i18n.locale).toBe('es');
  });
});
