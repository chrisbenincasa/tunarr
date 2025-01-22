import { AllTranscodeConfigColumns } from '@/db/schema/TranscodeConfig.js';
import type { DB } from '@/db/schema/db.js';
import type {
  ChannelWithRelations,
  ChannelWithTranscodeConfig,
} from '@/db/schema/derivedTypes.js';
import type { Maybe } from '@/types/util.js';
import type { Kysely, NotNull, SelectQueryBuilder } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite';
import { isString } from 'lodash-es';

export class ChannelQueryBuilder<Out extends ChannelWithRelations> {
  private constructor(
    private builder: SelectQueryBuilder<DB, 'channel', Out>,
  ) {}

  static create(db: Kysely<DB>) {
    return new ChannelQueryBuilder(db.selectFrom('channel').selectAll());
  }

  static createForIdOrNumber(db: Kysely<DB>, idOrNumber: string | number) {
    return this.create(db).withIdOrNumber(idOrNumber);
  }

  withId(uuid: string) {
    return new ChannelQueryBuilder(
      this.builder.where('channel.uuid', '=', uuid),
    );
  }

  withNumber(number: number) {
    return new ChannelQueryBuilder(
      this.builder.where('channel.number', '=', number),
    );
  }

  withIdOrNumber(idOrNumber: string | number) {
    if (isString(idOrNumber)) {
      return this.withId(idOrNumber);
    } else {
      return this.withNumber(idOrNumber);
    }
  }

  withFillerShows() {
    return new ChannelQueryBuilder(
      this.builder.select((qb) =>
        jsonArrayFrom(
          qb
            .selectFrom('channelFillerShow')
            .whereRef('channel.uuid', '=', 'channelFillerShow.channelUuid')
            .select([
              'channelFillerShow.channelUuid',
              'channelFillerShow.fillerShowUuid',
              'channelFillerShow.cooldown',
              'channelFillerShow.weight',
            ]),
        ).as('fillerShows'),
      ),
    );
  }

  withTranscodeConfig(): ChannelQueryBuilder<ChannelWithTranscodeConfig> {
    return new ChannelQueryBuilder(
      this.builder
        .select((eb) =>
          jsonObjectFrom(
            eb
              .selectFrom('transcodeConfig')
              .whereRef(
                'transcodeConfig.uuid',
                '=',
                'channel.transcodeConfigId',
              )
              .select(AllTranscodeConfigColumns),
          ).as('transcodeConfig'),
        )
        .$narrowType<{ transcodeConfig: NotNull }>(),
    );
  }

  execute(): Promise<Out[]> {
    return this.builder.execute();
  }

  executeTakeFirst(): Promise<Maybe<Out>> {
    return this.builder.executeTakeFirst();
  }
}
