import { TroubleshootService } from '@/services/TroubleshootService.js';
import type { RouterPluginCallback } from '@/types/serverType.js';
import {
  ChannelStreamModeSchema,
  TroubleshootRequestSchema,
  TroubleshootResultSchema,
} from '@tunarr/types/schemas';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod/v4';
import { container } from '../container.js';
import { TroubleshootSessionFolderName } from '../util/constants.ts';
import { injectTimestampMap } from './streamApi.ts';

export const troubleshootApiRouter: RouterPluginCallback = (
  fastify,
  _,
  done,
) => {
  fastify.post(
    '/troubleshoot',
    {
      schema: {
        tags: ['Troubleshoot'],
        body: TroubleshootRequestSchema,
        response: {
          200: TroubleshootResultSchema,
        },
      },
    },
    async (req) => {
      const service = container.get(TroubleshootService);
      return service.runTroubleshoot(req.body);
    },
  );

  fastify.get(
    '/troubleshoot/stream/:sessionId/:file',
    {
      schema: {
        hide: true,
        params: z.object({
          sessionId: z.uuid(),
          file: z.string(),
        }),
      },
    },
    async (req, res) => {
      const service = container.get(TroubleshootService);
      const dir = service.getSessionDirectory(req.params.sessionId);
      if (!dir) {
        return res.status(404).send('Session not found or expired');
      }

      const filePath = join(dir, req.params.file);

      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).send('File not found');
      }

      if (req.params.file.endsWith('.m3u8')) {
        const content = await fs.readFile(filePath);
        return res.type('application/vnd.apple.mpegurl').send(content);
      }

      if (req.params.file.endsWith('.ts')) {
        return res.type('video/mp2t').sendFile(req.params.file, dir);
      }

      return res.sendFile(req.params.file, dir);
    },
  );

  fastify.get(
    '/troubleshoot/:id/:file',
    {
      schema: {
        hide: true,
        params: z.object({
          sessionType: ChannelStreamModeSchema.refine(
            (typ) => typ !== 'mpegts',
          ),
          id: z.uuid(),
          file: z.string(),
        }),
      },
      config: {
        disableRequestLogging: 'only-errors',
      },
    },
    async (req, res) => {
      // let session: Maybe<BaseHlsSession>;
      // switch (req.params.sessionType) {
      //   case 'hls':
      //   case 'hls_direct_v2':
      //     session = req.serverCtx.sessionManager.getHlsSession(
      //       req.params.id,
      //       req.params.sessionType,
      //     );
      //     break;
      //   case 'hls_slower':
      //     session = req.serverCtx.sessionManager.getHlsSlowerSession(
      //       req.params.id,
      //     );
      //     break;
      //   default:
      //     return res
      //       .status(400)
      //       .send(
      //         `Invalid sesssion type for fragment file serving: ${req.params.sessionType}`,
      //       );
      // }

      // if (isUndefined(session)) {
      //   return res.status(404).send('No session found');
      // }

      // session.recordHeartbeat(req.ip);

      // if (
      //   req.params.file === 'stream.m3u8' &&
      //   (req.params.sessionType === 'hls' ||
      //     req.params.sessionType === 'hls_direct_v2')
      // ) {
      //   const playlistResult = await (session as HlsSession).trimPlaylist();
      //   if (playlistResult.isFailure()) {
      //     logger.error(playlistResult.error);
      //     return res.status(500).send('Error retrieving variant playlist');
      //   }
      //   const playlist = playlistResult.get();
      //   if (!playlist) {
      //     return res.status(404).send('Variant playlist not found');
      //   }
      //   return res
      //     .type('application/vnd.apple.mpegurl')
      //     .send(playlist.playlist);
      // }

      // session.onSegmentRequested(req.ip, req.params.file);

      if (req.params.file.endsWith('.vtt')) {
        const filePath = join(
          tmpdir(),
          TroubleshootSessionFolderName,
          req.params.file,
        );
        const content = await fs.readFile(filePath, 'utf-8');
        return res.type('text/vtt').send(injectTimestampMap(content));
      }

      if (req.params.file.endsWith('.m3u8')) {
        const filePath = join(
          tmpdir(),
          TroubleshootSessionFolderName,
          req.params.file,
        );
        const content = await fs.readFile(filePath);
        return res.type('application/vnd.apple.mpegurl').send(content);
      }

      return res.sendFile(
        req.params.file,
        join(tmpdir(), TroubleshootSessionFolderName),
      );
    },
  );

  done();
};
