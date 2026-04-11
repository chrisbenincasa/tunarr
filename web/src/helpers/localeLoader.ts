/**
 * Maps Lingui locale codes to their corresponding dayjs locale codes.
 * 'pseudo-LOCALE' has no dayjs equivalent, so it falls back to 'en'.
 */
export const LINGUI_TO_DAYJS: Record<string, string> = {
  en: 'en',
  es: 'es',
  'pseudo-LOCALE': 'en',
};

/**
 * Returns the dayjs locale code for a given Lingui locale.
 */
export function getLinguiToDayjsLocale(locale: string): string {
  return LINGUI_TO_DAYJS[locale] ?? 'en';
}

/**
 * Dynamically imports the dayjs locale module for a given Lingui locale.
 * 'en' is always built into dayjs and requires no dynamic import.
 */
export async function loadDayjsLocale(locale: string): Promise<void> {
  const dayjsLocale = getLinguiToDayjsLocale(locale);
  if (dayjsLocale !== 'en') {
    await import(`dayjs/locale/${dayjsLocale}.js`);
  }
}
