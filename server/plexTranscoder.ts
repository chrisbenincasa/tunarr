import * as fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { first, isNil, isPlainObject, isUndefined } from 'lodash-es';
import { DeepReadonly } from 'ts-essentials';
import { inspect } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { PlexServerSettings, PlexStreamSettings } from './dao/db.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { Plex } from './plex.js';
import { ContextChannel, Maybe, PlexBackedLineupItem } from './types.js';
import {
  PlexItemMetadata,
  PlexMediaContainer,
  TranscodeDecision,
  TranscodeDecisionMediaPartStream,
} from './types/plexApiTypes.js';

const logger = createLogger(import.meta);

type PlexStream = {
  directPlay: boolean;
  streamUrl: string;
  separateVideoStream?: string;
  streamStats?: VideoStats;
};

export type VideoStats = {
  duration?: number;
  anamorphic?: boolean;
  pixelP?: number;
  pixelQ?: number;
  videoCodec?: string;
  videoWidth: number;
  videoHeight: number;
  videoFramerate?: number;
  videoDecision?: string;
  audioDecision?: string;
  videoScanType?: string;
  audioOnly?: boolean;
  audioChannels?: number;
  audioCodec?: string;
  placeholderImage?: string;
  audioIndex?: string;
};

export class PlexTranscoder {
  private session: string;
  private device: string;
  private deviceName: string;
  private clientIdentifier: string;
  private product: string;
  private settings: DeepReadonly<PlexStreamSettings>;
  private key: string;
  // private metadataPath: string;
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
  private albumArt: Maybe<{ path?: string }>;
  private plex: Plex;
  private directInfo?: any;
  private videoIsDirect: boolean = false;

  constructor(
    clientId: string,
    server: DeepReadonly<PlexServerSettings>,
    settings: DeepReadonly<PlexStreamSettings>,
    channel: ContextChannel,
    lineupItem: PlexBackedLineupItem,
  ) {
    this.session = uuidv4();

    this.device = 'channel-' + channel.number;
    this.deviceName = this.device;
    this.clientIdentifier = clientId;
    this.product = 'dizqueTV';

    this.settings = settings;

    this.log('Plex transcoder initiated');
    this.log('Debug logging enabled');

    this.key = lineupItem.key;
    this.plex = new Plex(server);
    // this.metadataPath = `${lineupItem.key}?X-Plex-Token=${server.accessToken}`;
    this.plexFile = `${server.uri}${lineupItem.plexFile}?X-Plex-Token=${server.accessToken}`;
    if (!isUndefined(lineupItem.file)) {
      this.file = lineupItem.file.replace(
        settings.pathReplace,
        settings.pathReplaceWith,
      );
    }
    this.transcodeUrlBase = `${server.uri}/video/:/transcode/universal/start.m3u8?`;
    this.ratingKey = lineupItem.ratingKey;
    this.currTimeMs = lineupItem.start;
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
      path: null,
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
      // stream = { directPlay: true };
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
    if (directPlay || this.isAV1()) {
      if (!directPlay) {
        this.log(
          "Plex doesn't support av1, so we are forcing direct play, including for audio because otherwise plex breaks the stream.",
        );
      }
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
    } else if (this.isVideoDirectStream() === false) {
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
      streamStats,
    };

    this.log(stream);

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

    let vc = [...this.settings.videoCodecs];
    //This codec is not currently supported by plex so requesting it to transcode will always
    // cause an error. If Plex ever supports av1, remove this. I guess.
    if (vc.length > 0) {
      vc.push('av1');
    } else {
      vc = ['av1'];
    }

    let clientProfile = '';
    if (!audioOnly) {
      clientProfile = `add-transcode-target(type=videoProfile&protocol=${
        this.settings.streamProtocol
      }&container=${streamContainer}&videoCodec=${vc.join(
        ',',
      )}&audioCodec=${this.settings.audioCodecs.join(
        ',',
      )}&subtitleCodec=&context=streaming&replace=true)+\
add-transcode-target-settings(type=videoProfile&context=streaming&protocol=${
        this.settings.streamProtocol
      }&CopyMatroskaAttachments=true)+\
add-transcode-target-settings(type=videoProfile&context=streaming&protocol=${
        this.settings.streamProtocol
      }&BreakNonKeyframes=true)+\
add-limitation(scope=videoCodec&scopeName=*&type=upperBound&name=video.width&value=${
        resolution.widthPx
      })+\
add-limitation(scope=videoCodec&scopeName=*&type=upperBound&name=video.height&value=${
        resolution.heightPx
      })`;
    } else {
      clientProfile = `add-transcode-target(type=musicProfile&protocol=${
        this.settings.streamProtocol
      }&container=${streamContainer}&audioCodec=${this.settings.audioCodecs.join(
        ',',
      )}&subtitleCodec=&context=streaming&replace=true)`;
    }
    // Set transcode settings per audio codec
    this.settings.audioCodecs.forEach((codec) => {
      clientProfile += `+add-transcode-target-audio-codec(type=videoProfile&context=streaming&protocol=${this.settings.streamProtocol}&audioCodec=${codec})`;
      if (codec == 'mp3') {
        clientProfile += `+add-limitation(scope=videoAudioCodec&scopeName=${codec}&type=upperBound&name=audio.channels&value=2)`;
      } else {
        clientProfile += `+add-limitation(scope=videoAudioCodec&scopeName=${codec}&type=upperBound&name=audio.channels&value=${this.settings.maxAudioChannels})`;
      }
    });

    // deinterlace video if specified, only useful if overlaying channel logo later
    if (deinterlace == true) {
      clientProfile += `+add-limitation(scope=videoCodec&scopeName=*&type=notMatch&name=video.scanType&value=interlaced)`;
    }

    const clientProfile_enc = encodeURIComponent(clientProfile);
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
path=${this.key}&\
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
      if (this.getVideoStats().audioOnly) {
        return this.getVideoStats().audioDecision === 'copy';
      }
      return (
        this.getVideoStats().videoDecision === 'copy' &&
        this.getVideoStats().audioDecision === 'copy'
      );
    } catch (e) {
      console.error('Error at decision:', e);
      return false;
    }
  }

  getVideoStats(): VideoStats {
    const ret: Partial<VideoStats> = {};

    try {
      const streams: TranscodeDecisionMediaPartStream[] =
        this.decisionJson?.Metadata[0].Media[0].Part[0].Stream ?? [];
      ret.duration = this.decisionJson?.Metadata[0].Media[0].Part[0].duration;
      streams.forEach((stream) => {
        // Video
        if (stream.streamType === 1) {
          // Dont understand this...we're iterating the stream, isnt this already
          // set tot Stream[$index]
          // if (
          //   this.videoIsDirect === true &&
          //   typeof this.directInfo !== 'undefined'
          // ) {
          //   stream =
          //     this.directInfo.Metadata[0].Media[0].Part[0].Stream[$index];
          // }
          ret.anamorphic =
            stream.anamorphic === '1' || stream.anamorphic === true;
          if (ret.anamorphic) {
            const parsed = parsePixelAspectRatio(stream.pixelAspectRatio);
            if (isNaN(parsed.p) || isNaN(parsed.q)) {
              throw Error('isNaN');
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
          ret.videoFramerate = Math.round(stream['frameRate']);
          // Rounding framerate avoids scenarios where
          // 29.9999999 & 30 don't match.
          ret.videoDecision = isUndefined(stream.decision)
            ? 'copy'
            : stream.decision;
          ret.videoScanType = stream.scanType;
        }
        // Audio. Only look at stream being used
        if (stream['streamType'] == '2' && stream['selected'] == '1') {
          ret.audioChannels = stream['channels'];
          ret.audioCodec = stream['codec'];
          ret.audioDecision = isUndefined(stream.decision)
            ? 'copy'
            : stream.decision;
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

    this.log('Current video stats:');
    this.log(ret);

    return ret as Required<VideoStats>; // This isn't technically right, but this is how the current code treats this
  }

  async getAudioIndex() {
    let index = 'a';
    const response = await this.plex.Get(this.key);
    this.log(response);
    try {
      const streams = response.Metadata[0].Media[0].Part[0].Stream;

      streams.forEach(function (stream) {
        // Audio. Only look at stream being used
        if (stream['streamType'] == '2' && stream['selected'] == '1') {
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
    return this.plex.Get(this.key);
    // return (await axios.get(this.metadataPath)).data;
  }

  async getDecisionUnmanaged(directPlay: boolean) {
    this.decisionJson = await this.plex.Get<TranscodeDecision>(
      `/video/:/transcode/universal/decision?${this.transcodingArgs}`,
    );

    if (isUndefined(this.decisionJson)) {
      throw new Error('Got unexpected undefined response from Plex');
    }

    this.log('Received transcode decision:');
    this.log(this.decisionJson);

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

  async tryToDetectAudioOnly() {
    try {
      this.log('Try to detect audio only:');
      const mediaContainer = await this.plex.Get<PlexItemMetadata>(
        `${this.key}?${this.transcodingArgs}`,
      );

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

  async getDecision(directPlay: boolean) {
    try {
      await this.getDecisionUnmanaged(directPlay);
    } catch (err) {
      console.error(err);
    }
  }

  getStatusUrl() {
    const profileName = `Generic`;

    const containerKey = `/video/:/transcode/universal/decision?${this.transcodingArgs}`;
    const containerKey_enc = encodeURIComponent(containerKey);

    return `/:/timeline?\
containerKey=${containerKey_enc}&\
ratingKey=${this.ratingKey}&\
state=${this.playState}&\
key=${this.key}&\
time=${this.currTimeMs}&\
duration=${this.duration}&\
X-Plex-Product=${this.product}&\
X-Plex-Platform=${profileName}&\
X-Plex-Client-Platform=${profileName}&\
X-Plex-Client-Profile-Name=${profileName}&\
X-Plex-Device-Name=${this.deviceName}&\
X-Plex-Device=${this.device}&\
X-Plex-Client-Identifier=${this.clientIdentifier}&\
X-Plex-Platform=${profileName}&\
X-Plex-Token=${this.server.accessToken}`;
  }

  startUpdatingPlex() {
    if (this.settings.updatePlayStatus == true) {
      this.playState = 'playing';
      this.updatePlex(); // do initial update
      this.updatingPlex = setInterval(
        () => this.updatePlex(),
        this.updateInterval,
      );
    }
  }

  stopUpdatingPlex() {
    if (this.settings.updatePlayStatus == true) {
      clearInterval(this.updatingPlex);
      this.playState = 'stopped';
      this.updatePlex();
    }
  }

  updatePlex() {
    this.log('Updating plex status');
    const statusUrl = this.getStatusUrl();
    try {
      this.plex.Post(statusUrl);
    } catch (error) {
      this.log(`Problem updating Plex status using status URL ${statusUrl}:`);
      this.log(error);
      return false;
    }
    this.currTimeMs += this.updateInterval;
    if (this.currTimeMs > this.duration) {
      this.currTimeMs = this.duration;
    }
    this.currTimeS = this.duration / 1000;
    return true;
  }

  log(message: any) {
    if (this.settings.enableDebugLogging) {
      const msg = isPlainObject(message) ? inspect(message) : message;
      logger.info(msg);
    }
  }
}

function parsePixelAspectRatio(s) {
  const x = s.split(':');
  return {
    p: parseInt(x[0], 10),
    q: parseInt(x[1], 10),
  };
}

function getOneOrUndefined(object, field) {
  if (isUndefined(object)) {
    return undefined;
  }
  if (isUndefined(object[field])) {
    return undefined;
  }
  const x = object[field];
  if (x.length < 1) {
    return undefined;
  }
  return x[0];
}
