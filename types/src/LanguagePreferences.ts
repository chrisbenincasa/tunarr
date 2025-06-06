import z from 'zod/v4';
import {
  LanguagePreferenceSchema,
  LanguagePreferencesSchema,
} from './schemas/settingsSchemas.js';

export type LanguagePreference = z.infer<typeof LanguagePreferenceSchema>;
export type LanguagePreferences = z.infer<typeof LanguagePreferencesSchema>;

export const defaultLanguagePreferences = LanguagePreferencesSchema.parse({
  preferences: [{ iso6391: 'en', iso6392: 'eng', displayName: 'English' }],
});
