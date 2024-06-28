import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export interface CachedImage {
  hash: string;
  mimeType: string | null;
  url: string;
}

export interface Channel {
  createdAt: string | null;
  disableFillerOverlay: Generated<number>;
  duration: number;
  fillerRepeatCooldown: number | null;
  groupTitle: string | null;
  guideFlexTitle: string | null;
  guideMinimumDuration: number;
  icon: string | null;
  name: string;
  number: number;
  offline: Generated<string | null>;
  startTime: number;
  stealth: Generated<number>;
  transcoding: string | null;
  updatedAt: string | null;
  uuid: string;
  watermark: string | null;
}

export interface ChannelCustomShows {
  channelUuid: string;
  customShowUuid: string;
}

export interface ChannelFallback {
  channelUuid: string;
  programUuid: string;
}

export interface ChannelFillerShow {
  channelUuid: string;
  cooldown: number;
  fillerShowUuid: string;
  weight: number;
}

export interface ChannelPrograms {
  channelUuid: string;
  programUuid: string;
}

export interface CustomShow {
  createdAt: string | null;
  name: string;
  updatedAt: string | null;
  uuid: string;
}

export interface CustomShowContent {
  contentUuid: string;
  customShowUuid: string;
  index: number;
}

export interface FillerShow {
  createdAt: string | null;
  name: string;
  updatedAt: string | null;
  uuid: string;
}

export interface FillerShowContent {
  fillerShowUuid: string;
  index: number;
  programUuid: string;
}

export interface MikroOrmMigrations {
  executedAt: Generated<string | null>;
  id: Generated<number>;
  name: string | null;
}

export interface PlexServerSettings {
  accessToken: string;
  clientIdentifier: string | null;
  createdAt: string | null;
  index: number;
  name: string;
  sendChannelUpdates: Generated<number>;
  sendGuideUpdates: Generated<number>;
  updatedAt: string | null;
  uri: string;
  uuid: string;
}

export interface Program {
  albumName: string | null;
  albumUuid: string | null;
  artistName: string | null;
  artistUuid: string | null;
  createdAt: string | null;
  duration: number;
  episode: number | null;
  episodeIcon: string | null;
  externalKey: string;
  externalSourceId: string;
  filePath: string | null;
  grandparentExternalKey: string | null;
  icon: string | null;
  originalAirDate: string | null;
  parentExternalKey: string | null;
  plexFilePath: string | null;
  plexRatingKey: string | null;
  rating: string | null;
  seasonIcon: string | null;
  seasonNumber: number | null;
  seasonUuid: string | null;
  showIcon: string | null;
  showTitle: string | null;
  sourceType: string;
  summary: string | null;
  title: string;
  tvShowUuid: string | null;
  type: string;
  updatedAt: string | null;
  uuid: string;
  year: number | null;
}

export interface ProgramExternalId {
  createdAt: string | null;
  directFilePath: string | null;
  externalFilePath: string | null;
  externalKey: string;
  externalSourceId: string | null;
  programUuid: string;
  sourceType: string;
  updatedAt: string | null;
  uuid: string;
}

export interface ProgramGrouping {
  artistUuid: string | null;
  createdAt: string | null;
  icon: string | null;
  index: number | null;
  showUuid: string | null;
  summary: string | null;
  title: string;
  type: string;
  updatedAt: string | null;
  uuid: string;
  year: number | null;
}

export interface ProgramGroupingExternalId {
  createdAt: string | null;
  externalFilePath: string | null;
  externalKey: string;
  externalSourceId: string | null;
  groupUuid: string;
  sourceType: string;
  updatedAt: string | null;
  uuid: string;
}

export interface DB {
  cachedImage: CachedImage;
  channel: Channel;
  channelCustomShows: ChannelCustomShows;
  channelFallback: ChannelFallback;
  channelFillerShow: ChannelFillerShow;
  channelPrograms: ChannelPrograms;
  customShow: CustomShow;
  customShowContent: CustomShowContent;
  fillerShow: FillerShow;
  fillerShowContent: FillerShowContent;
  mikroOrmMigrations: MikroOrmMigrations;
  plexServerSettings: PlexServerSettings;
  program: Program;
  programExternalId: ProgramExternalId;
  programGrouping: ProgramGrouping;
  programGroupingExternalId: ProgramGroupingExternalId;
}
