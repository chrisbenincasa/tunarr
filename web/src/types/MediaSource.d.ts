export type ItemUuid = string;
export type Plex = 'plex';
export type Jellyfin = 'jellyfin';
export type Emby = 'emby';
export type Imported = 'imported';
export type Local = 'local';

export type Typed<T, Type> = T & { type: Type };
export type TypedKey<T, Type, K extends string> = Typed<
  {
    [Prop in K]: T;
  },
  Type
>;
