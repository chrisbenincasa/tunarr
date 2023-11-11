export type ProgramType =
  | 'movie'
  | 'episode'
  | 'track'
  | 'redirect'
  | 'custom'
  | 'flex';

export type Program = {
  title: string;
  key: string;
  ratingKey: string;
  icon: string;
  type: ProgramType;
  duration: number;
  summary: string;
  plexFile: string;
  file: string;
  showTitle?: string; // Unclear if this is necessary
  episode?: number;
  season?: number;
  episodeIcon?: string;
  seasonIcon?: string;
  showIcon?: string;
  serverKey: string;
  rating?: string;
  date?: string;
  year?: number;
  channel?: number; // Redirect
  isOffline: boolean; // Flex
  customShowId?: string;
  customShowName?: string;
  customOrder?: number;
};
