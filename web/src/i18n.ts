import { i18n } from '@lingui/core';
import { messages as enMessages } from './locales/en/messages';

/**
 * Loads and activates a Lingui message catalog for the given locale.
 * Falls back to English if the catalog cannot be loaded.
 * Idempotent: skips loading if the locale is already active.
 */
export async function loadCatalog(locale: string) {
  if (i18n.locale === locale) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { messages } = await import(`./locales/${locale}/messages`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    i18n.loadAndActivate({ locale, messages });
  } catch {
    i18n.loadAndActivate({ locale: 'en', messages: enMessages });
  }
}
