import { BuiltInPresets } from '@tunarr/shared/channel-templates';
import type { Channel } from '@tunarr/types';
import type {
  AutoChannelCreateRequest,
  ContentPreviewResponse,
} from '@tunarr/types/api';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { describe, expect, test, vi } from 'vitest';
import type { AutoChannelService } from '../services/AutoChannelService.ts';
import { GenericBadRequestError } from '../types/errors.ts';
import type { ZodTypeProvider } from '../util/zod.ts';
import { AutoChannelApiController } from './autoChannelApi.ts';

// The real service module pulls in the DI container and the scheduler.
vi.mock('../services/AutoChannelService.ts', () => ({
  AutoChannelService: class {},
}));

const channel: Channel = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  name: '24/7 Shuffle 7',
  number: 7,
  duration: 0,
  startTime: 0,
  groupTitle: 'Auto-Created',
  icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
  stealth: false,
  disableFillerOverlay: false,
  guideMinimumDuration: 30000,
  offline: { mode: 'pic' },
  onDemand: { enabled: false },
  programCount: 2,
  streamMode: 'hls',
  transcodeConfigId: '5f0e7c2a-3b1d-4e8f-9a6c-1d2b3c4d5e6f',
  subtitlesEnabled: false,
  useEtvNext: false,
  streamSelectionProfileId: null,
};

const preview: ContentPreviewResponse = {
  totalPrograms: 2,
  byType: { movie: 2, episode: 0, track: 0, music_video: 0, other_video: 0 },
  topShows: [],
  totalDurationMs: 7_200_000,
  sampleIds: ['p1', 'p2'],
};

const createRequest: AutoChannelCreateRequest = {
  presetId: '24-7-shuffle',
  contentAssignments: { all: { query: {} } },
  channelNumber: 7,
};

async function makeApp() {
  const service = {
    getPresets: vi.fn(() => BuiltInPresets),
    previewContent: vi.fn(() => Promise.resolve(preview)),
    createChannel: vi.fn(() => Promise.resolve(channel)),
  };

  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(
    new AutoChannelApiController(service as unknown as AutoChannelService)
      .mount,
  );

  return { app, service };
}

describe('GET /auto-channels/presets', () => {
  test('lists the built-in presets', async () => {
    const { app } = await makeApp();

    const res = await app.inject({
      method: 'GET',
      url: '/auto-channels/presets',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ id: string }[]>().map((p) => p.id)).toEqual(
      BuiltInPresets.map((p) => p.id),
    );
  });
});

describe('POST /auto-channels/preview-content', () => {
  test('returns the preview for the query', async () => {
    const { app, service } = await makeApp();
    const query = { programTypes: ['movie'] };

    const res = await app.inject({
      method: 'POST',
      url: '/auto-channels/preview-content',
      payload: query,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(preview);
    expect(service.previewContent).toHaveBeenCalledWith(query);
  });

  test('rejects an unknown program type without searching', async () => {
    const { app, service } = await makeApp();

    const res = await app.inject({
      method: 'POST',
      url: '/auto-channels/preview-content',
      payload: { programTypes: ['podcast'] },
    });

    expect(res.statusCode).toBe(400);
    expect(service.previewContent).not.toHaveBeenCalled();
  });
});

describe('POST /auto-channels/create', () => {
  test('answers 201 with the new channel', async () => {
    const { app, service } = await makeApp();

    const res = await app.inject({
      method: 'POST',
      url: '/auto-channels/create',
      payload: createRequest,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json<Channel>().id).toBe(channel.id);
    expect(service.createChannel).toHaveBeenCalledWith(createRequest);
  });

  test('rejects a channel number below 1 without creating anything', async () => {
    const { app, service } = await makeApp();

    const res = await app.inject({
      method: 'POST',
      url: '/auto-channels/create',
      payload: { ...createRequest, channelNumber: 0 },
    });

    expect(res.statusCode).toBe(400);
    expect(service.createChannel).not.toHaveBeenCalled();
  });

  test('answers 400 with the reason for a bad request', async () => {
    const { app, service } = await makeApp();
    service.createChannel.mockRejectedValueOnce(
      new GenericBadRequestError('"Genre" needs a content filter'),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/auto-channels/create',
      payload: createRequest,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ message: '"Genre" needs a content filter' });
  });

  test('finds a bad request wrapped in another error', async () => {
    const { app, service } = await makeApp();
    service.createChannel.mockRejectedValueOnce(
      new Error('create failed', {
        cause: new GenericBadRequestError('Preset not found: nope'),
      }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/auto-channels/create',
      payload: createRequest,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ message: 'Preset not found: nope' });
  });

  test('answers 500 for any other failure', async () => {
    const { app, service } = await makeApp();
    service.createChannel.mockRejectedValueOnce(
      new Error('No default transcode config exists'),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/auto-channels/create',
      payload: createRequest,
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      message: 'No default transcode config exists',
    });
  });
});
