import type { NewTranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { defaultTranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import type { DB } from '@/db/schema/db.js';
import { booleanToNumber } from '@/util/sqliteUtil.js';
import type { Resolution } from '@tunarr/types';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { isEmpty } from 'lodash-es';
import { v4 } from 'uuid';

export default {
  async up(db: Kysely<DB>) {
    await db.schema
      .createTable('transcode_config')
      .ifNotExists()
      .addColumn('uuid', 'text', (col) => col.primaryKey().notNull())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('thread_count', 'integer', (col) => col.notNull())
      .addColumn('hardware_acceleration_mode', 'text', (col) =>
        col
          .notNull()
          .check(
            sql`\`hardware_acceleration_mode\` in ('none', 'cuda', 'vaapi', 'qsv', 'videotoolbox')`,
          ),
      )
      .addColumn('vaapi_driver', 'text', (col) =>
        col
          .defaultTo('system')
          .check(
            sql`\`vaapi_driver\` in ('system', 'ihd', 'i965', 'radeonsi', 'nouveau')`,
          ),
      )
      .addColumn('vaapi_device', 'text')
      .addColumn('resolution', 'json', (col) => col.notNull())
      .addColumn('video_format', 'text', (col) =>
        col
          .notNull()
          .check(sql`\`video_format\` in ('h264', 'hevc', 'mpeg2video')`),
      )
      .addColumn('video_profile', 'text')
      .addColumn('video_preset', 'text')
      .addColumn('video_bit_depth', 'integer')
      .addColumn('video_bit_rate', 'integer', (col) => col.notNull())
      .addColumn('video_buffer_size', 'integer', (col) => col.notNull())
      .addColumn('audio_channels', 'integer', (col) => col.notNull())
      .addColumn('audio_format', 'text', (col) =>
        col
          .notNull()
          .check(sql`\`audio_format\` in ('aac', 'ac3', 'copy', 'mp3')`),
      )
      .addColumn('audio_bit_rate', 'integer', (col) => col.notNull())
      .addColumn('audio_buffer_size', 'integer', (col) => col.notNull())
      .addColumn('audio_sample_rate', 'integer', (col) => col.notNull())
      .addColumn('audio_volume_percent', 'integer', (col) =>
        col.notNull().defaultTo(100),
      )
      .addColumn('normalize_frame_rate', 'boolean', (col) =>
        col.notNull().defaultTo(false),
      )
      .addColumn('deinterlace_video', 'boolean', (col) =>
        col.notNull().defaultTo(true),
      )
      .addColumn('disable_channel_overlay', 'boolean', (col) =>
        col.notNull().defaultTo(false),
      )
      .addColumn('error_screen', 'text', (col) =>
        col
          .notNull()
          .defaultTo('pic')
          .check(
            sql`\`error_screen\` in ('static', 'pic', 'blank', 'testsrc', 'text', 'kill')`,
          ),
      )
      .addColumn('error_screen_audio', 'text', (col) =>
        col
          .notNull()
          .defaultTo('silent')
          .check(
            sql`(\`error_screen_audio\` in ('silent', 'sine', 'whitenoise'))`,
          ),
      )
      .addColumn('is_default', 'boolean', (col) =>
        col.notNull().defaultTo(false),
      )
      .execute();

    await db.schema
      .alterTable('channel')
      .addColumn('transcode_config_id', 'text', (col) =>
        col.references('transcode_config.uuid'),
      )
      .execute();

    const defaultConfig = defaultTranscodeConfig(true);
    const transcodeConfigId = (
      await db
        .insertInto('transcodeConfig')
        .values(defaultConfig)
        .returning('uuid')
        .executeTakeFirstOrThrow()
    ).uuid;
    console.log('created default config');

    const allChannels = await db.selectFrom('channel').selectAll().execute();

    for (const channel of allChannels) {
      let configIdToUse = transcodeConfigId;
      if (channel.transcoding && !isEmpty(channel.transcoding)) {
        // Needs an override config
        configIdToUse = v4();
        const newConfig: NewTranscodeConfig = {
          ...defaultConfig,
          uuid: configIdToUse,
          name: `Default + Channel ${channel.number} override`,
          isDefault: booleanToNumber(false),
        };

        if (channel.transcoding.targetResolution) {
          newConfig.resolution = JSON.stringify(
            channel.transcoding.targetResolution satisfies Resolution,
          );
        }
        if (channel.transcoding.videoBitrate) {
          newConfig.videoBitRate = channel.transcoding.videoBitrate;
        }
        if (channel.transcoding.videoBufferSize) {
          newConfig.videoBufferSize = channel.transcoding.videoBufferSize;
        }
        await db
          .insertInto('transcodeConfig')
          .values(newConfig)
          .executeTakeFirstOrThrow();
      }

      await db
        .updateTable('channel')
        .set('transcodeConfigId', configIdToUse)
        .where('channel.uuid', '=', channel.uuid)
        .executeTakeFirstOrThrow();
    }
  },

  async down(db: Kysely<unknown>) {
    await db.schema
      .alterTable('channel')
      .dropColumn('transcode_config_id')
      .execute();
    await db.schema.dropTable('transcode_config').ifExists().execute();
  },
};
