import dayjs from 'dayjs';
import { compact, isEmpty, orderBy } from 'lodash-es';
import { v4 } from 'uuid';
import { z } from 'zod/v4';
import type { InvidiousOtherVideo } from '../../types/Media.ts';
import { titleToSortTitle } from '../../util/programs.ts';
import type { ApiClientOptions, QueryResult } from '../BaseApiClient.ts';
import { MediaSourceApiClient } from '../MediaSourceApiClient.ts';

/**
 * Invidious only ever backs "other videos" libraries: one library per YouTube
 * channel, one program per upload. Everything the movie/show/music parts of
 * MediaSourceApiClient expect is empty here.
 */

const InvidiousThumbnail = z.looseObject({
  quality: z.string().optional(),
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const InvidiousChannelVideo = z.looseObject({
  type: z.string().optional(),
  title: z.string(),
  videoId: z.string(),
  author: z.string().optional(),
  authorId: z.string().optional(),
  description: z.string().nullish(),
  published: z.number().nullish(),
  lengthSeconds: z.number(),
  liveNow: z.boolean().optional(),
  isUpcoming: z.boolean().optional(),
  premium: z.boolean().optional(),
  videoThumbnails: z.array(InvidiousThumbnail).optional(),
});

type InvidiousChannelVideo = z.infer<typeof InvidiousChannelVideo>;

const InvidiousChannelVideosPage = z.looseObject({
  videos: z.array(InvidiousChannelVideo),
  continuation: z.string().nullish(),
});

const InvidiousChannel = z.looseObject({
  author: z.string(),
  authorId: z.string(),
});

const InvidiousAdaptiveFormat = z.looseObject({
  url: z.string(),
  itag: z.string().or(z.number()).optional(),
  type: z.string(),
  bitrate: z.string().or(z.number()).nullish(),
  resolution: z.string().nullish(),
  qualityLabel: z.string().nullish(),
  fps: z.number().nullish(),
  // "1920x1080"
  size: z.string().nullish(),
  audioChannels: z.number().nullish(),
});

type InvidiousAdaptiveFormat = z.infer<typeof InvidiousAdaptiveFormat>;

const InvidiousVideo = z.looseObject({
  videoId: z.string(),
  title: z.string(),
  lengthSeconds: z.number(),
  liveNow: z.boolean().optional(),
  adaptiveFormats: z.array(InvidiousAdaptiveFormat).default([]),
});

const InvidiousResolveUrl = z.looseObject({
  ucid: z.string().nullish(),
  browseId: z.string().nullish(),
});

export type InvidiousStreamPair = {
  videoUrl: string;
  audioUrl: string;
  width: number;
  height: number;
  frameRate: number | undefined;
  videoCodec: string;
  audioCodec: string;
  audioChannels: number;
};

// The highest video height we will ask YouTube for. Tunarr re-encodes to the
// channel's transcode resolution anyway, so anything above 1080p is wasted
// bandwidth for a typical 1080p channel.
const MaxVideoHeight = 1080;

// Uploads shorter than this are skipped by the scanner: intros, trailers,
// community clips. Shorts live on a separate tab and never appear here.
const DefaultMinimumDurationSeconds = 300;

function minimumDurationSeconds() {
  const fromEnv = Number.parseInt(
    process.env['TUNARR_INVIDIOUS_MIN_DURATION_SECONDS'] ?? '',
    10,
  );
  return Number.isFinite(fromEnv) && fromEnv >= 0
    ? fromEnv
    : DefaultMinimumDurationSeconds;
}

const ChannelIdPattern = /^UC[A-Za-z0-9_-]{22}$/;

export class InvidiousApiClient extends MediaSourceApiClient {
  // A scan asks for the library size and then iterates the videos; both need
  // the full channel listing, so it is fetched once per client and reused.
  #channelVideosCache = new Map<string, Promise<InvidiousChannelVideo[]>>();

  constructor(options: ApiClientOptions) {
    super(options);
  }

  static isChannelId(value: string) {
    return ChannelIdPattern.test(value);
  }

  async ping(): Promise<boolean> {
    await this.doGet({ url: '/api/v1/stats' });
    return true;
  }

  /**
   * Accepts a UC… channel id, an @handle, or any youtube.com channel URL and
   * returns the canonical UC… channel id.
   */
  async resolveChannelId(input: string): Promise<QueryResult<string>> {
    const trimmed = input.trim();
    if (InvidiousApiClient.isChannelId(trimmed)) {
      return this.makeSuccessResult(trimmed);
    }

    const channelPathMatch = /\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(trimmed);
    if (channelPathMatch?.[1]) {
      return this.makeSuccessResult(channelPathMatch[1]);
    }

    const url = trimmed.startsWith('http')
      ? trimmed
      : `https://www.youtube.com/${trimmed.startsWith('@') ? trimmed : `@${trimmed}`}`;

    const result = await this.doTypeCheckedGet(
      '/api/v1/resolveurl',
      InvidiousResolveUrl,
      { params: { url } },
    );

    return result.flatMap((resolved) => {
      const id = resolved.ucid ?? resolved.browseId;
      if (id && InvidiousApiClient.isChannelId(id)) {
        return this.makeSuccessResult(id);
      }
      return this.makeErrorResult<string>(
        'not_found',
        `Could not resolve "${input}" to a YouTube channel`,
      );
    });
  }

  getChannel(channelId: string) {
    return this.doTypeCheckedGet(
      `/api/v1/channels/${encodeURIComponent(channelId)}`,
      InvidiousChannel,
    );
  }

  async getChannelVideoCount(channelId: string): Promise<number> {
    return (await this.listChannelVideos(channelId)).length;
  }

  async *getChannelVideos(
    channelId: string,
  ): AsyncIterable<InvidiousOtherVideo> {
    for (const video of await this.listChannelVideos(channelId)) {
      yield this.convertChannelVideo(video);
    }
  }

  /**
   * Resolves fresh, signed stream URLs for a video. These expire after a few
   * hours and are tied to the address that requested them, so this has to be
   * called when a program starts playing, never at scan time.
   *
   * YouTube only serves up to 360p as a single muxed file, so we take the best
   * H.264 video track and the best AAC audio track separately and let ffmpeg
   * read them as two inputs.
   */
  async getStreamPair(
    videoId: string,
  ): Promise<QueryResult<InvidiousStreamPair>> {
    const result = await this.doTypeCheckedGet(
      `/api/v1/videos/${encodeURIComponent(videoId)}`,
      InvidiousVideo,
    );

    return result.flatMap((video) => {
      const pair = pickStreamPair(video.adaptiveFormats);
      if (!pair) {
        return this.makeErrorResult<InvidiousStreamPair>(
          'not_found',
          `No playable H.264/AAC formats for YouTube video ${videoId}`,
        );
      }
      return this.makeSuccessResult(pair);
    });
  }

  getVideo(videoId: string) {
    return this.doTypeCheckedGet(
      `/api/v1/videos/${encodeURIComponent(videoId)}`,
      InvidiousVideo,
    ).then((result) =>
      result.map((video) =>
        this.convertChannelVideo({
          ...video,
          videoThumbnails: [],
        }),
      ),
    );
  }

  private listChannelVideos(channelId: string) {
    let cached = this.#channelVideosCache.get(channelId);
    if (!cached) {
      cached = this.fetchAllChannelVideos(channelId);
      this.#channelVideosCache.set(channelId, cached);
      // Drop the listing once it has had time to serve one scan.
      setTimeout(
        () => this.#channelVideosCache.delete(channelId),
        dayjs.duration(30, 'minutes').asMilliseconds(),
      ).unref();
    }
    return cached;
  }

  private async fetchAllChannelVideos(
    channelId: string,
  ): Promise<InvidiousChannelVideo[]> {
    const minimumSeconds = minimumDurationSeconds();
    const seen = new Set<string>();
    const videos: InvidiousChannelVideo[] = [];
    let continuation: string | undefined;

    for (;;) {
      const page = await this.doTypeCheckedGet(
        `/api/v1/channels/${encodeURIComponent(channelId)}/videos`,
        InvidiousChannelVideosPage,
        { params: continuation ? { continuation } : {} },
      );

      const { videos: pageVideos, continuation: next } = page.getOrThrow();

      for (const video of pageVideos) {
        if (seen.has(video.videoId)) {
          continue;
        }
        seen.add(video.videoId);
        if (
          video.liveNow ||
          video.isUpcoming ||
          video.premium ||
          video.lengthSeconds < minimumSeconds
        ) {
          continue;
        }
        videos.push(video);
      }

      if (isEmpty(pageVideos) || !next || next === continuation) {
        break;
      }
      continuation = next;
    }

    this.logger.debug(
      'Listed %d eligible videos for YouTube channel %s',
      videos.length,
      channelId,
    );

    return videos;
  }

  private convertChannelVideo(
    video: InvidiousChannelVideo,
  ): InvidiousOtherVideo {
    const published = video.published ? dayjs.unix(video.published) : null;
    const durationMs = video.lengthSeconds * 1000;
    const thumbnailUrl = new URL(
      `/vi/${video.videoId}/maxresdefault.jpg`,
      this.options.mediaSource.uri,
    ).href;

    return {
      uuid: v4(),
      // Nothing else about an upload changes in a way that matters to a
      // schedule, so these three are enough to skip unchanged videos on rescan.
      canonicalId: `${video.videoId}|${video.lengthSeconds}|${video.title}`,
      sourceType: 'invidious',
      externalId: video.videoId,
      type: 'other_video',
      title: video.title,
      sortTitle: titleToSortTitle(video.title),
      originalTitle: null,
      year: published?.year() ?? null,
      releaseDate: published?.valueOf() ?? null,
      releaseDateString: published?.format() ?? null,
      tags: compact([video.author]),
      studios: video.author ? [{ name: video.author }] : [],
      identifiers: [
        {
          type: 'invidious',
          id: video.videoId,
          sourceId: this.options.mediaSource.uuid,
        },
      ],
      mediaSourceId: this.options.mediaSource.uuid,
      libraryId: '',
      duration: durationMs,
      // The real formats are only known when a stream URL is resolved, so
      // this describes what we will ask for. Tunarr needs a resolution here to
      // create the program's media version at all.
      mediaItem: {
        duration: durationMs,
        resolution: { widthPx: 1920, heightPx: 1080 },
        displayAspectRatio: '16:9',
        frameRate: 30,
        streams: [
          { index: 0, streamType: 'video', codec: 'h264' },
          { index: 0, streamType: 'audio', codec: 'aac', channels: 2 },
        ],
        locations: [
          {
            type: 'remote',
            sourceType: 'invidious',
            externalKey: video.videoId,
            path: video.videoId,
          },
        ],
        externalKey: video.videoId,
      },
      artwork: [
        { type: 'thumbnail' as const, path: thumbnailUrl },
        { type: 'poster' as const, path: thumbnailUrl },
      ],
      state: 'ok',
    };
  }

  // Invidious backs only "other videos" libraries.

  getMovieLibraryContents(): AsyncIterable<never> {
    return emptyIterable();
  }

  getMovie(): Promise<QueryResult<never>> {
    return Promise.resolve(this.unsupported());
  }

  getTvShowLibraryContents(): AsyncIterable<never> {
    return emptyIterable();
  }

  getShow(): Promise<QueryResult<never>> {
    return Promise.resolve(this.unsupported());
  }

  getShowSeasons(): AsyncIterable<never> {
    return emptyIterable();
  }

  getSeasonEpisodes(): AsyncIterable<never> {
    return emptyIterable();
  }

  getSeason(): Promise<QueryResult<never>> {
    return Promise.resolve(this.unsupported());
  }

  getEpisode(): Promise<QueryResult<never>> {
    return Promise.resolve(this.unsupported());
  }

  getMusicLibraryContents(): AsyncIterable<never> {
    return emptyIterable();
  }

  getArtistAlbums(): AsyncIterable<never> {
    return emptyIterable();
  }

  getMusicArtist(): Promise<QueryResult<never>> {
    return Promise.resolve(this.unsupported());
  }

  getMusicAlbum(): Promise<QueryResult<never>> {
    return Promise.resolve(this.unsupported());
  }

  getAlbumTracks(): AsyncIterable<never> {
    return emptyIterable();
  }

  getMusicTrack(): Promise<QueryResult<never>> {
    return Promise.resolve(this.unsupported());
  }

  private unsupported(): QueryResult<never> {
    return this.makeErrorResult(
      'not_found',
      'Invidious sources only provide "other videos" libraries',
    );
  }
}

const emptyIterable = (): AsyncIterable<never> => ({
  [Symbol.asyncIterator]: () => ({
    next: () => Promise.resolve({ done: true, value: undefined }),
  }),
});

function formatHeight(format: InvidiousAdaptiveFormat): number {
  const fromResolution = Number.parseInt(format.resolution ?? '', 10);
  if (Number.isFinite(fromResolution)) {
    return fromResolution;
  }
  return Number.parseInt(format.qualityLabel ?? '', 10) || 0;
}

function formatBitrate(format: InvidiousAdaptiveFormat): number {
  return Number(format.bitrate ?? 0) || 0;
}

/**
 * Picks the best H.264 video track at or below MaxVideoHeight and the best
 * AAC audio track. H.264 and AAC decode everywhere, including on the
 * hardware encoders Tunarr uses, which is why VP9 and AV1 are passed over even
 * when they offer more resolution.
 */
export function pickStreamPair(
  formats: InvidiousAdaptiveFormat[],
): InvidiousStreamPair | undefined {
  const video = orderBy(
    formats.filter((format) => {
      const height = formatHeight(format);
      return (
        format.type.startsWith('video/mp4') &&
        format.type.includes('avc1') &&
        height > 0 &&
        height <= MaxVideoHeight
      );
    }),
    [formatHeight, (format) => format.fps ?? 0, formatBitrate],
    ['desc', 'desc', 'desc'],
  )[0];

  const audio = orderBy(
    formats.filter(
      (format) =>
        format.type.startsWith('audio/mp4') && format.type.includes('mp4a'),
    ),
    // Multi-language uploads list one track per dub; the original-language
    // track is the one YouTube marks "acont=original" in the URL's xtags.
    [
      (format) => (/acont%3Doriginal|acont=original/.test(format.url) ? 1 : 0),
      formatBitrate,
    ],
    ['desc', 'desc'],
  )[0];

  if (!video || !audio) {
    return;
  }

  const [sizeWidth, sizeHeight] = (video.size ?? '')
    .split('x')
    .map((n) => Number.parseInt(n, 10));
  const height = sizeHeight || formatHeight(video);
  return {
    videoUrl: video.url,
    audioUrl: audio.url,
    height,
    width: sizeWidth || Math.round((height * 16) / 9),
    frameRate: video.fps ?? undefined,
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioChannels: audio.audioChannels ?? 2,
  };
}
