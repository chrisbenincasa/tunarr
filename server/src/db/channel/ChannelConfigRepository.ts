import { KEYS } from '@/types/inject.js';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import type { DB } from '../schema/db.ts';
import type { ChannelSubtitlePreferences } from '../schema/SubtitlePreferences.ts';

@injectable()
export class ChannelConfigRepository {
  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
  ) {}

  async getChannelSubtitlePreferences(
    id: string,
  ): Promise<ChannelSubtitlePreferences[]> {
    return this.db
      .selectFrom('channelSubtitlePreferences')
      .selectAll()
      .where('channelId', '=', id)
      .orderBy('priority asc')
      .execute();
  }
}
