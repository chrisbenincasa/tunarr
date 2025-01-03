import { CompiledQuery, Kysely, Migration } from 'kysely';

export default {
  async up(db: Kysely<unknown>): Promise<void> {
    // Add language preferences to ffmpeg_settings
    await db.executeQuery(
      CompiledQuery.raw(`
        UPDATE settings 
        SET ffmpeg = json_set(
          ffmpeg, 
          '$.languagePreferences', 
          '{"preferences":[{"iso6391":"en","iso6392":"eng","displayName":"English"}]}'
        )
        WHERE json_extract(ffmpeg, '$.languagePreferences') IS NULL;
      `),
    );
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.executeQuery(
      CompiledQuery.raw(`
        UPDATE settings 
        SET ffmpeg = json_remove(ffmpeg, '$.languagePreferences');
      `),
    );
  },
} satisfies Migration;
