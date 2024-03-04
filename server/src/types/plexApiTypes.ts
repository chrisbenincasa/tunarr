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
  Part: TranscodeDecisionMediaPart[];
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

export type TranscodeDecisionMediaPart = {
  id: number;
  key: string;
  duration: number;
  file: string;
  size: number;
  audioProfile: string;
  container: string;
  videoProfile: string;
  Stream: TranscodeDecisionMediaStream[];
};

export type TranscodeDecisionMediaStream = {
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
  channels?: number;
  scanType?: string;
  // Haven't been able to get Plex to return this type, so
  // we're going very permissive.
  anamorphic?: ('1' | '0') | boolean;
  pixelAspectRatio?: string;
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
  Part: PlexMediaPart[];
};

export type PlexMediaPart = {
  Stream: PlexMediaStream[];
};

export function isPlexVideoStream(
  stream: PlexMediaStream,
): stream is PlexMediaVideoStream {
  return stream.streamType === 1;
}

export function isPlexAudioStream(
  stream: PlexMediaStream,
): stream is PlexMediaAudioStream {
  return stream.streamType === 2;
}

export type PlexMediaBaseStream = {
  id: number;
  streamType: number;
  default: boolean;
  codec: string;
  index: number;
  displayTitle: string;
  extendedDisplayTitle: string;
  language: string;
  languageCode: string;
  languageTag: string;
  title: string;
  selected?: boolean;
};

export type PlexMediaVideoStream = PlexMediaBaseStream & {
  // Haven't been able to get Plex to return this type, so
  // we're going very permissive.
  anamorphic?: ('1' | '0') | boolean;
  bitrate: number;
  bitDepth: number;
  chromaLocation: string;
  chromaSubsampling: string;
  codedHeight: number;
  codedWidth: number;
  frameRate: number;
  hasScalingMatrix: boolean;
  height: number;
  level: number;
  profile: string;
  refFrames: number;
  scanType: string;
  width: number;
  // Unclear if this exists on direct streams, but we add it
  // here for parity
  pixelAspectRatio?: string;
};

export type PlexMediaAudioStream = PlexMediaBaseStream & {
  audioChannelLayout: string;
  channels: number;
  bitrate: number;
  samplingRate: number;
};

export type PlexMediaSubtitleStream = PlexMediaBaseStream & {
  bitrate: number;
};

export type PlexMediaStream =
  | PlexMediaVideoStream
  | PlexMediaAudioStream
  | PlexMediaSubtitleStream;

export type PlexStatusResponse = {
  size: number;
  playbackState: string;
  skipCount: number;
  viewCount: number;
  viewOffset: number;
  Bandwidths: {
    Bandwidth: PlexStatusBandwidth;
  }[];
};

export type PlexStatusBandwidth = {
  time: number;
  bandwidth: number;
  resolution: string;
};
