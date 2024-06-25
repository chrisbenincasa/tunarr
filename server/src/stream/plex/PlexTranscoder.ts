import { PlexStreamSettings } from '@tunarr/types';
import { first, isNil, isUndefined, pick } from 'lodash-es';
import { constants as fsConstants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { stringify } from 'node:querystring';
import { DeepReadonly } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { ContentBackedStreamLineupItem } from '../../dao/derived_types/StreamLineup.js';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { serverOptions } from '../../globals.js';
import { Plex } from '../../external/plex.js';
import { PlexApiFactory } from '../../external/PlexApiFactory.js';
import { StreamContextChannel } from '../types.js';
import { Maybe } from '../../types/util.js';
import {
  PlexItemMetadata,
  PlexMediaContainer,
  PlexMediaVideoStream,
  TranscodeDecision,
  TranscodeDecisionMediaStream,
  isPlexVideoStream,
} from '../../types/plexApiTypes.js';
import { Logger, LoggerFactory } from '../../util/logging/LoggerFactory.js';

export type PlexStream = {
  directPlay: boolean;
  streamUrl: string;
  separateVideoStream?: string;
  streamDetails?: StreamDetails;
};

export type StreamDetails = {
  duration?: number;
  anamorphic?: boolean;
  pixelP?: number;
  pixelQ?: number;

  videoCodec?: string;
  videoWidth?: number;
  videoHeight?: number;
  videoFramerate?: number;
  videoDecision?: string;
  videoScanType?: string;
  videoBitDepth?: number;

  audioDecision?: string;
  audioOnly?: boolean;
  audioChannels?: number;
  audioCodec?: string;
  audioIndex?: string;

  placeholderImage?: string;

  serverPath?: string;
  directFilePath?: string;
};

export class PlexTranscoder {
  private logger: Logger;
  private session: string;
  private device: string;
  private deviceName: string;
  private clientIdentifier: string;
  private product: string;
  private settings: DeepReadonly<PlexStreamSettings>;
  private plexFile: string;
  private file: string;
  private transcodeUrlBase: string;
  private ratingKey: string;
  private currTimeMs: number;
  public currTimeS: number;
  private duration: number;
  private server: PlexServerSettings;
  private transcodingArgs: string | undefined;
  private decisionJson: Maybe<PlexMediaContainer<TranscodeDecision>>;
  private updateInterval: number;
  private updatingPlex: NodeJS.Timeout | undefined;
  private playState: string;
  private mediaHasNoVideo: boolean;
  private albumArt: { path?: string; attempted: boolean };
  private plex: Plex;
  private directInfo?: PlexItemMetadata;
  private videoIsDirect: boolean = false;
  private cachedItemMetadata: Maybe<PlexItemMetadata>;

  constructor(
    clientId: string,
    server: PlexServerSettings,
    settings: DeepReadonly<PlexStreamSettings>,
    channel: StreamContextChannel,
    lineupItem: ContentBackedStreamLineupItem,
  ) {
    this.logger = LoggerFactory.child({
      plexServer: server.name,
      channel: channel.uuid,
      caller: import.meta,
    });
    this.session = uuidv4();

    this.device = 'channel-' + channel.number;
    this.deviceName = this.device;
    this.clientIdentifier = clientId;
    this.product = 'Tunarr';

    this.settings = settings;

    if (settings.enableDebugLogging) {
      this.log('Plex transcoder initiated');
      this.log('Debug logging enabled');
    }

    this.plex = PlexApiFactory().get(server);
    // this.metadataPath = `${lineupItem.key}?X-Plex-Token=${server.accessToken}`;
    this.plexFile = `${server.uri}${lineupItem.plexFilePath}?X-Plex-Token=${server.accessToken}`;
    if (!isUndefined(lineupItem.filePath)) {
      this.file = lineupItem.filePath.replace(
        settings.pathReplace,
        settings.pathReplaceWith,
      );
    }
    this.transcodeUrlBase = `${server.uri}/video/:/transcode/universal/start.m3u8?`;
    this.ratingKey = lineupItem.externalKey;
    this.currTimeMs = lineupItem.start ?? 0;
    this.currTimeS = this.currTimeMs / 1000;
    this.duration = lineupItem.duration;
    this.server = server;

    this.transcodingArgs = undefined;
    this.decisionJson = undefined;

    this.updateInterval = 30000;
    this.updatingPlex = undefined;
    this.playState = 'stopped';
    this.mediaHasNoVideo = false;
    this.albumArt = {
      attempted: false,
    };
  }

  async getStream(deinterlace: boolean): Promise<PlexStream> {
    // let stream: PlexStream = { directPlay: false };
    let directPlay: boolean = false;
    let streamUrl: string;
    let separateVideoStream: Maybe<string>;

    this.log('Getting stream');
    this.log(`  deinterlace:     ${deinterlace}`);
    this.log(`  streamPath:      ${this.settings.streamPath}`);

    this.setTranscodingArgs(directPlay, true, false, false);
    await this.tryToDetectAudioOnly();

    if (
      this.settings.streamPath === 'direct' ||
      this.settings.forceDirectPlay
    ) {
      if (this.settings.enableSubtitles) {
        this.log('Direct play is forced, so subtitles are forcibly disabled.');
        this.settings = { ...this.settings, enableSubtitles: false };
      }
      directPlay = true;
    } else {
      try {
        this.log('Setting transcoding parameters');
        this.setTranscodingArgs(
          directPlay,
          true,
          deinterlace,
          this.mediaHasNoVideo,
        );
        await this.getDecision(directPlay);
        if (this.isDirectPlay()) {
          directPlay = true;
          streamUrl = this.plexFile;
        }
      } catch (err) {
        console.error(
          "Error when getting decision. 1. Check Plex connection. 2. This might also be a sign that plex direct play and transcode settings are too strict and it can't find any allowed action for the selected video.",
          err,
        );
        directPlay = true;
      }
    }
    if (directPlay /* || this.isAV1()*/) {
      // if (!directPlay) {
      //   this.log(
      //     "Plex doesn't support av1, so we are forcing direct play, including for audio because otherwise plex breaks the stream.",
      //   );
      // }
      this.log('Direct play forced or native paths enabled');
      directPlay = true;
      this.setTranscodingArgs(directPlay, true, false, this.mediaHasNoVideo);
      // Update transcode decision for session
      await this.getDecision(directPlay);
      streamUrl =
        this.settings.streamPath === 'direct' ? this.file : this.plexFile;
      if (this.settings.streamPath === 'direct') {
        await fs.access(this.file, fsConstants.F_OK);
      }
      if (isUndefined(streamUrl)) {
        throw Error(
          'Direct path playback is not possible for this program because it was registered at a time when the direct path settings were not set. To fix this, you must either revert the direct path setting or rebuild this channel.',
        );
      }
    } else if (!this.isVideoDirectStream()) {
      this.log('Decision: Should transcode');
      // Change transcoding arguments to be the user chosen transcode parameters
      this.setTranscodingArgs(
        directPlay,
        false,
        deinterlace,
        this.mediaHasNoVideo,
      );
      // Update transcode decision for session
      await this.getDecision(directPlay);
      streamUrl = `${this.transcodeUrlBase}${this.transcodingArgs}`;
    } else {
      //This case sounds complex. Apparently plex is sending us just the audio, so we would need to get the video in a separate stream.
      this.log('Decision: Direct stream. Audio is being transcoded');
      separateVideoStream =
        this.settings.streamPath === 'direct' ? this.file : this.plexFile;
      streamUrl = `${this.transcodeUrlBase}${this.transcodingArgs}`;
      this.directInfo = await this.getDirectInfo();
      this.videoIsDirect = true;
    }

    const streamStats = this.getVideoStats();

    // use correct audio stream if direct play
    streamStats.audioIndex = directPlay ? await this.getAudioIndex() : 'a';

    const stream: PlexStream = {
      directPlay,
      streamUrl,
      separateVideoStream,
      streamDetails: streamStats,
    };

    this.log('PlexStream: %O', stream);

    return stream;
  }

  setTranscodingArgs(
    directPlay: boolean,
    directStream: boolean,
    deinterlace: boolean,
    audioOnly: boolean,
  ) {
    const resolution = directStream
      ? this.settings.maxPlayableResolution
      : this.settings.maxTranscodeResolution;
    const bitrate = directStream
      ? this.settings.directStreamBitrate
      : this.settings.transcodeBitrate;
    const mediaBufferSize = directStream
      ? this.settings.mediaBufferSize
      : this.settings.transcodeMediaBufferSize;
    const subtitles = this.settings.enableSubtitles ? 'burn' : 'none'; // subtitle options: burn, none, embedded, sidecar
    const streamContainer = 'mpegts'; // Other option is mkv, mkv has the option of copying it's subs for later processing
    const isDirectPlay = directPlay ? '1' : '0';
    const hasMDE = '1';

    const videoQuality = `100`; // Not sure how this applies, maybe this works if maxVideoBitrate is not set
    const profileName = `Generic`; // Blank profile, everything is specified through X-Plex-Client-Profile-Extra

    const vc = [...this.settings.videoCodecs];
    //This codec is not currently supported by plex so requesting it to transcode will always
    // cause an error. If Plex ever supports av1, remove this. I guess.
    // UPDATE: Plex 1.30.1 added AV1 playback support - experimentally removing this clause here.
    // if (vc.length > 0) {
    //   vc.push('av1');
    // } else {
    //   vc = ['av1'];
    // }

    // let clientProfile = '';
    const clientProfileParts: string[] = [];
    if (!audioOnly) {
      clientProfileParts.push(
        transcodeTarget({
          type: 'videoProfile',
          protocol: this.settings.streamProtocol,
          container: streamContainer,
          videoCodecs: vc,
          audioCodecs: this.settings.audioCodecs,
          subtitleCodecs: [],
        }),
        transcodeTargetSettings({
          type: 'videoProfile',
          protocol: this.settings.streamProtocol,
          settings: {
            CopyMatroskaAttachments: true,
          },
        }),
        transcodeTargetSettings({
          type: 'videoProfile',
          protocol: this.settings.streamProtocol,
          settings: { BreakNonKeyframes: true },
        }),
        transcodeLimitation({
          scope: 'videoCodec',
          scopeName: '*',
          type: 'upperBound',
          name: 'video.width',
          value: resolution.widthPx,
        }),
        transcodeLimitation({
          scope: 'videoCodec',
          scopeName: '*',
          type: 'upperBound',
          name: 'video.height',
          value: resolution.heightPx,
        }),
      );
    } else {
      clientProfileParts.push(
        transcodeTarget({
          type: 'musicProfile',
          protocol: this.settings.streamProtocol,
          container: streamContainer,
          audioCodecs: this.settings.audioCodecs,
        }),
      );
    }

    // Set transcode settings per audio codec
    this.settings.audioCodecs.forEach((codec) => {
      clientProfileParts.push(
        transcodeAudioTarget({
          type: 'videoProfile',
          protocol: this.settings.streamProtocol,
          audioCodec: codec,
        }),
      );
      if (codec == 'mp3') {
        clientProfileParts.push(
          transcodeLimitation({
            scope: 'videoAudioCodec',
            scopeName: codec,
            type: 'upperBound',
            name: 'audio.channels',
            value: 2,
          }),
        );
      } else {
        clientProfileParts.push(
          transcodeLimitation({
            scope: 'videoAudioCodec',
            scopeName: codec,
            type: 'upperBound',
            name: 'audio.channels',
            value: this.settings.maxAudioChannels,
          }),
        );
      }
    });

    // deinterlace video if specified, only useful if overlaying channel logo later
    if (deinterlace == true) {
      clientProfileParts.push(
        transcodeLimitation({
          scope: 'videoCodec',
          scopeName: '*',
          type: 'notMatch',
          name: 'video.scanType',
          value: 'interlaced',
        }),
      );
    }

    const clientProfile_enc = encodeURIComponent(clientProfileParts.join('+'));
    this.transcodingArgs = `X-Plex-Platform=${profileName}&\
X-Plex-Product=${this.product}&\
X-Plex-Client-Platform=${profileName}&\
X-Plex-Client-Profile-Name=${profileName}&\
X-Plex-Device-Name=${this.deviceName}&\
X-Plex-Device=${this.device}&\
X-Plex-Client-Identifier=${this.clientIdentifier}&\
X-Plex-Platform=${profileName}&\
X-Plex-Token=${this.server.accessToken}&\
X-Plex-Client-Profile-Extra=${clientProfile_enc}&\
protocol=${this.settings.streamProtocol}&\
Connection=keep-alive&\
hasMDE=${hasMDE}&\
path=/library/metadata/${this.ratingKey}&\
mediaIndex=0&\
partIndex=0&\
fastSeek=1&\
directPlay=${isDirectPlay}&\
directStream=1&\
directStreamAudio=1&\
copyts=1&\
audioBoost=${this.settings.audioBoost}&\
mediaBufferSize=${mediaBufferSize}&\
session=${this.session}&\
offset=${this.currTimeS}&\
subtitles=${subtitles}&\
subtitleSize=${this.settings.subtitleSize}&\
maxVideoBitrate=${bitrate}&\
videoQuality=${videoQuality}&\
videoResolution=${resolution.widthPx}x${resolution.heightPx}&\
lang=en`;
  }

  isVideoDirectStream() {
    try {
      return this.getVideoStats().videoDecision === 'copy';
    } catch (e) {
      console.error('Error at decision:', e);
      return false;
    }
  }

  isAV1() {
    try {
      return this.getVideoStats().videoCodec === 'av1';
    } catch (e) {
      return false;
    }
  }

  isDirectPlay() {
    try {
      const videoStats = this.getVideoStats();
      if (videoStats.audioOnly) {
        return videoStats.audioDecision === 'copy';
      }
      return (
        videoStats.videoDecision === 'copy' &&
        videoStats.audioDecision === 'copy'
      );
    } catch (e) {
      console.error('Error at decision:', e);
      return false;
    }
  }

  // TODO - cache this somehow so we only update VideoStats if decisionJson or directInfo change
  getVideoStats(): StreamDetails {
    const ret: Partial<StreamDetails> = {};

    try {
      const streams: TranscodeDecisionMediaStream[] =
        this.decisionJson?.Metadata[0].Media[0].Part[0].Stream ?? [];
      ret.duration = this.decisionJson?.Metadata[0].Media[0].Part[0].duration;
      streams.forEach((_stream, idx) => {
        // Video
        if (_stream.streamType === 1) {
          let stream: TranscodeDecisionMediaStream | PlexMediaVideoStream =
            _stream;
          if (this.videoIsDirect && !isNil(this.directInfo)) {
            const directStream =
              this.directInfo.Metadata[0].Media[0].Part[0].Stream[idx];
            if (isPlexVideoStream(directStream)) {
              stream = directStream;
            }
          }
          ret.anamorphic =
            stream.anamorphic === '1' || stream.anamorphic === true;
          if (ret.anamorphic) {
            const parsed = parsePixelAspectRatio(stream.pixelAspectRatio);
            if (isUndefined(parsed)) {
              throw Error(
                'Unable to parse pixelAspectRatio: ' + stream.pixelAspectRatio,
              );
            }
            ret.pixelP = parsed.p;
            ret.pixelQ = parsed.q;
          } else {
            ret.pixelP = 1;
            ret.pixelQ = 1;
          }
          ret.videoCodec = stream.codec;
          ret.videoWidth = stream.width;
          ret.videoHeight = stream.height;
          ret.videoFramerate = Math.round(stream.frameRate);
          // Rounding framerate avoids scenarios where
          // 29.9999999 & 30 don't match.
          ret.videoDecision = isUndefined(stream['decision'] as Maybe<string>)
            ? 'copy'
            : (stream['decision'] as string);
          ret.videoScanType = stream.scanType;
        }

        // Audio. Only look at stream being used
        if (_stream.streamType === 2 && _stream.selected) {
          ret.audioChannels = _stream.channels;
          ret.audioCodec = _stream.codec;
          ret.audioDecision = isUndefined(_stream.decision)
            ? 'copy'
            : _stream.decision;
        }
      });
    } catch (e) {
      console.error('Error at decision:', e);
    }

    if (isUndefined(ret.videoCodec)) {
      ret.audioOnly = true;
      ret.placeholderImage = !isNil(this.albumArt?.path)
        ? (ret.placeholderImage = this.albumArt.path)
        : (ret.placeholderImage = `http://localhost:${
            serverOptions().port
          }/images/generic-music-screen.png`);
    }

    this.log('Current video stats: %O', ret);

    return ret as Required<StreamDetails>; // This isn't technically right, but this is how the current code treats this
  }

  private async getAudioIndex() {
    let index: string | number = 'a';
    // Duplicate call to API here ... we should try to keep a cache.
    const response = await this.getPlexItemMetadata();
    this.log('Got Plex item metadata response: %O', response);

    if (isUndefined(response)) {
      return index;
    }

    try {
      const streams = response.Metadata[0].Media[0].Part[0].Stream;

      streams.forEach(function (stream) {
        // Audio. Only look at stream being used
        if (stream.streamType === 2 && stream.selected) {
          index = stream.index;
        }
      });
    } catch (e) {
      console.error('Error at get media info:' + e);
    }

    this.log(`Found audio index: ${index}`);

    return index;
  }

  async getDirectInfo() {
    return this.getPlexItemMetadata();
  }
  async tryToDetectAudioOnly() {
    try {
      this.log('Try to detect audio only:');
      const mediaContainer = await this.getPlexItemMetadata();

      const metadata = first(mediaContainer?.Metadata);
      if (!isUndefined(metadata)) {
        this.albumArt = this.albumArt || {};
        this.albumArt.path = `${this.server.uri}${metadata.thumb}?X-Plex-Token=${this.server.accessToken}`;

        const media = first(metadata.Media);
        if (!isUndefined(media)) {
          if (isUndefined(media.videoCodec)) {
            this.log('Audio-only file detected');
            this.mediaHasNoVideo = true;
          }
        }
      }
    } catch (err) {
      console.error('Error when getting album art', err);
    }
  }

  async getDecisionUnmanaged(directPlay: boolean) {
    this.decisionJson = await this.plex.doGet<TranscodeDecision>(
      `/video/:/transcode/universal/decision?${this.transcodingArgs}`,
    );

    if (isUndefined(this.decisionJson)) {
      throw new Error('Got unexpected undefined response from Plex');
    }

    this.log('Received transcode decision: %O', this.decisionJson);

    // Print error message if transcode not possible
    // TODO: handle failure better
    // mdeDecisionCode doesn't seem to exist on later Plex versions...
    // if (response.mdeDecisionCode === 1000) {
    //   this.log("mde decision code 1000, so it's all right?");
    //   return;
    // }

    const transcodeDecisionCode = this.decisionJson.transcodeDecisionCode;
    if (isUndefined(transcodeDecisionCode)) {
      this.log('Strange case, attempt direct play');
    } else if (!(directPlay || transcodeDecisionCode == 1001)) {
      this.log(
        `IMPORTANT: Recieved transcode decision code ${transcodeDecisionCode}! Expected code 1001.`,
      );
      this.log(`Error message: '${this.decisionJson.transcodeDecisionText}'`);
    }
  }

  async getDecision(directPlay: boolean) {
    try {
      await this.getDecisionUnmanaged(directPlay);
    } catch (err) {
      console.error(err);
    }
  }

  private getStatusUrl(): {
    path: string;
    params: Record<string, string | number>;
  } {
    const profileName = `Generic`;

    const containerKey = `/video/:/transcode/universal/decision?${this.transcodingArgs}`;
    const containerKey_enc = encodeURIComponent(containerKey);

    return {
      path: '/:/timeline',
      params: {
        containerKey: containerKey_enc,
        ratingKey: this.ratingKey,
        state: this.playState,
        key: `/library/metadata/${this.ratingKey}`,
        time: this.currTimeMs,
        duration: this.duration,
        'X-Plex-Product': this.product,
        'X-Plex-Platform': profileName,
        'X-Plex-Client-Platform': profileName,
        'X-Plex-Client-Profile-Name': profileName,
        'X-Plex-Device-Name': this.deviceName,
        'X-Plex-Device': this.device,
        'X-Plex-Client-Identifier': this.clientIdentifier,
        'X-Plex-Token': this.server.accessToken,
      },
    };
  }

  private async getPlexItemMetadata(force: boolean = false) {
    if (!force && !isUndefined(this.cachedItemMetadata)) {
      this.log('Using cached response from Plex for metadata');
      return this.cachedItemMetadata;
    }

    this.cachedItemMetadata = await this.plex.doGet<PlexItemMetadata>(
      `/library/metadata/${this.ratingKey}`,
    );
    return this.cachedItemMetadata;
  }

  async startUpdatingPlex() {
    if (this.settings.updatePlayStatus == true) {
      this.playState = 'playing';
      await this.updatePlex(); // do initial update
      this.updatingPlex = setInterval(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async () => await this.updatePlex(),
        this.updateInterval,
      );
    }
  }

  async stopUpdatingPlex() {
    if (this.settings.updatePlayStatus == true) {
      clearInterval(this.updatingPlex);
      this.playState = 'stopped';
      await this.updatePlex();
    }
  }

  private async updatePlex() {
    this.log('Updating plex status');
    const { path: statusUrl, params } = this.getStatusUrl();
    try {
      await this.plex.doPost(statusUrl, params);
    } catch (error) {
      this.logger.warn(
        `Problem updating Plex status using status URL ${statusUrl}: `,
        error,
      );
      return false;
    }
    this.currTimeMs += this.updateInterval;
    if (this.currTimeMs > this.duration) {
      this.currTimeMs = this.duration;
    }
    this.currTimeS = this.duration / 1000;
    return true;
  }

  //(obj: unknown, msg?: string, ...args: any[]): void;
  //(msg: string, ...args: any[]): void;
  // private log(obj: unknown, msg?: string, ...args: unknown[]): void;
  private log(obj: object, msg?: string, ...args: unknown[]): void;
  private log(msg: string, ...args: unknown[]);
  private log(
    t0: string | object,
    msg: string | undefined,
    ...rest: unknown[]
  ): void {
    if (this.settings.enableDebugLogging) {
      return this.logger.debug(t0, msg, ...rest);
    } else {
      return this.logger.trace(t0, msg, ...rest);
    }
  }
}

function parsePixelAspectRatio(s: Maybe<string>) {
  if (isUndefined(s)) return;
  const x = s.split(':');
  return {
    p: parseInt(x[0], 10),
    q: parseInt(x[1], 10),
  };
}

function transcodeTarget(opts: {
  type: 'videoProfile' | 'musicProfile';
  protocol: string;
  container: string;
  videoCodecs?: ReadonlyArray<string>;
  audioCodecs?: ReadonlyArray<string>;
  subtitleCodecs?: ReadonlyArray<string>;
}) {
  const parts = {
    ...pick(opts, ['type', 'protocol', 'container']),
    subtitleCodec: (opts.subtitleCodecs ?? []).join(','),
    context: 'streaming',
    replace: true,
  };

  if (opts.videoCodecs) {
    parts['videoCodec'] = opts.videoCodecs.join(',');
  }

  if (opts.audioCodecs) {
    parts['audioCodec'] = opts.audioCodecs.join(',');
  }

  return `add-transcode-target(${stringify(parts)})`;
}

function transcodeTargetSettings(opts: {
  type: string;
  protocol: string;
  settings: Record<string, string | boolean | number>;
}) {
  const parts = {
    ...pick(opts, ['type', 'protocol']),
    ...opts.settings,
    context: 'streaming',
  };

  return `add-transcode-target-settings(${stringify(parts)})`;
}

function transcodeLimitation(opts: {
  scope: string;
  scopeName: string;
  type: string;
  name: string;
  value: string | number;
}) {
  return `add-limitation(${stringify(opts)})`;
}

function transcodeAudioTarget(opts: {
  type: 'videoProfile';
  protocol: string;
  audioCodec: string;
}) {
  const parts = {
    ...opts,
    context: 'streaming',
  };

  return `add-transcode-target-audio-codec(${stringify(parts)})`;
}
