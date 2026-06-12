import { inject, injectable } from 'inversify';
import { isNil, isString } from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { KEYS } from '../../types/inject.ts';
import { Maybe } from '../../types/util.ts';
import { ChannelOrm } from '../schema/Channel.ts';
import { ChannelOrmWithRelations } from '../schema/derivedTypes.ts';
import { DrizzleDBAccess } from '../schema/index.ts';

@injectable()
export class ChannelReadOpsRepository {
  constructor(@inject(KEYS.DrizzleDB) private db: DrizzleDBAccess) {}

  async channelExists(channelId: string): Promise<boolean> {
    const channel = await this.db.query.channels.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, channelId),
      columns: {
        uuid: true,
      },
    });
    return !isNil(channel);
  }

  getChannelOrm(
    id: string | number,
  ): Promise<
    Maybe<
      MarkRequired<ChannelOrmWithRelations, 'transcodeConfig' | 'fillerShows'>
    >
  > {
    return this.db.query.channels
      .findFirst({
        where: (channel, { eq }) => {
          return isString(id) ? eq(channel.uuid, id) : eq(channel.number, id);
        },
        with: {
          transcodeConfig: true,
          channelFillerShow: {
            with: {
              filler: true,
            },
          },
        },
      })
      .then((maybeChannel) => {
        if (!maybeChannel) {
          return;
        }

        return {
          ...maybeChannel,
          fillerShows: maybeChannel.channelFillerShow.map((show) => ({
            channelUuid: maybeChannel.uuid,
            cooldown: show.cooldown,
            fillerShowUuid: show.fillerShowUuid,
            weight: show.weight,
          })),
        } satisfies MarkRequired<
          ChannelOrmWithRelations,
          'transcodeConfig' | 'fillerShows'
        >;
      });
  }

  getChannel(id: string | number): Promise<Maybe<ChannelOrmWithRelations>>;
  getChannel(
    id: string | number,
    includeFiller: true,
  ): Promise<Maybe<MarkRequired<ChannelOrmWithRelations, 'fillerShows'>>>;
  async getChannel(
    id: string | number,
    includeFiller: boolean = false,
  ): Promise<Maybe<ChannelOrmWithRelations>> {
    return await this.db.query.channels.findFirst({
      where: (fields, { eq }) =>
        isString(id) ? eq(fields.uuid, id) : eq(fields.number, id),
      with: {
        channelFillerShow: includeFiller ? true : undefined,
        transcodeConfig: true,
      },
    });
  }

  getAllChannels(): Promise<ChannelOrm[]> {
    return this.db.query.channels
      .findMany({
        orderBy: (fields, { asc }) => asc(fields.number),
      })
      .execute();
  }
}
