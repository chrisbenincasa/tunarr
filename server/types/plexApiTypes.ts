export type PlexMediaContainerResponse<T> = {
  MediaContainer: PlexMediaContainer<T>;
};

export type PlexMediaContainer<T> = {
  [K in keyof T]: T[K];
};

// http://{plexUrl}/video/:/transcode/universal/decision
export type TranscodeDecision = {
  size: number;
  abr: boolean;
  allowSync: string;
  directPlayDecisionCode: number;
  directPlayDecisionText: string;
  generateDecisionCode: number;
  generateDecisionText: string;
  identifier: string;
  librarySectionID: string;
  librarySectionTitle: string;
  librarySectionUUID: string;
  transcodeDecisionCode: number;
  transcodeDecisionText: string;
  Metadata: PlexMediaMetadata<PlexTranscodeMedia>[];
};

export type PlexTranscodeMedia = {
  id: string;
  videoProfile: string;
  audioChannels: number;
  audioCodec: string;
  container: string;
  duration: number;
  height: number;
  optimizedForStreaming: boolean;
  protocol: string;
  videoCodec: string;
  videoFrameRate: string;
  videoResolution: string;
  width: number;
  selected: boolean;
  Part: TranscodeDecisionMetadataMediaPart[];
};

export type PlexMediaMetadata<T> = {
  ratingKey: string;
  key: string;
  guid: string;
  studio: string;
  type: string;
  title: string;
  librarySectionTitle: string;
  librarySectionID: number;
  librarySectionKey: string;
  contentRating: string;
  summary: string;
  rating: number;
  audienceRating: number;
  year: number;
  tagline: string;
  thumb: string;
  art: string;
  duration: number;
  originallyAvailableAt: string;
  addedAt: number;
  updatedAt: number;
  audienceRatingImage: string;
  chapterSource: string;
  primaryExtraKey: string;
  ratingImage: string;
  Media: T[];
};

export type TranscodeDecisionMetadataMediaPart = {
  id: number;
  key: string;
  duration: number;
  file: string;
  size: number;
  audioProfile: string;
  container: string;
  videoProfile: string;
  Stream: TranscodeDecisionMediaPartStream[];
};

export type TranscodeDecisionMediaPartStream = {
  bitrate: number;
  codec: string;
  default: boolean;
  displayTitle: string;
  extendedDisplayTitle: string;
  frameRate: number;
  height: number;
  width: number;
  id: string;
  language: string;
  languageCode: string;
  languageTag: string;
  requiredBandwidths: string;
  selected: boolean;
  streamType: number;
  decision: string;
  location: string;
};

// http://{plexUrl}/{serverKey}
export type PlexItemMetadata = {
  size: number;
  Metadata: PlexMediaMetadata<PlexMedia>[];
};

export type PlexMedia = {
  id: number;
  duration: number;
  bitrate: number;
  width: number;
  height: number;
  aspectRatio: number;
  audioChannels: number;
  audioCodec: string;
  videoCodec: string;
  videoResolution: string;
  container: string;
  videoFrameRate: string;
  audioProfile: string;
  videoProfile: string;
  Part: TranscodeDecisionMetadataMediaPart[];
};
