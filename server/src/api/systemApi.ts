import { VainfoProcessHelper } from '@/ffmpeg/builder/capabilities/VainfoProcessHelper.js';
import { serverOptions } from '@/globals.js';
import { scheduleBackupJobs } from '@/services/Scheduler.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { getDefaultLogLevel } from '@/util/defaults.js';
import { ifDefined } from '@/util/index.js';
import {
  getEnvironmentLogLevel,
  getPrettyStreamOpts,
  LoggerFactory,
} from '@/util/logging/LoggerFactory.js';
import TailFile from '@logdna/tail-file';
import { seq } from '@tunarr/shared/util';
import type { LoggingSettings, SystemSettings } from '@tunarr/types';
import type { SystemSettingsResponse } from '@tunarr/types/api';
import {
  SystemSettingsResponseSchema,
  UpdateBackupSettingsRequestSchema,
  UpdateSystemSettingsRequestSchema,
} from '@tunarr/types/api';
import type { BackupSettings } from '@tunarr/types/schemas';
import { BackupSettingsSchema, HealthCheckSchema } from '@tunarr/types/schemas';
import { identity, isError, isUndefined, map } from 'lodash-es';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { join } from 'path/posix';
import type { PrettyOptions } from 'pino-pretty';
import pretty from 'pino-pretty';
import split2 from 'split2';
import { PassThrough } from 'stream';
import type { DeepReadonly, Writable } from 'ts-essentials';
import { z } from 'zod/v4';
import { container } from '../container.ts';
import { MigrationStateSchema } from '../db/SettingsDB.ts';
import { NvidiaGpuDetectionHelper } from '../ffmpeg/builder/capabilities/NvidiaHardwareCapabilitiesFactory.ts';
import { MeilisearchService } from '../services/MeilisearchService.ts';
import { SystemDevicesService } from '../services/SystemDevicesService.ts';
import { Result } from '../types/result.ts';
import { TruthyQueryParam } from '../types/schemas.ts';
import { ChildProcessHelper } from '../util/ChildProcessHelper.ts';
import {
  isDocker,
  isPodman,
  isRunningInContainer,
} from '../util/containerUtil.ts';
import { streamFileBackwards } from '../util/fsUtil.ts';
import { take } from '../util/streams.ts';

export const systemApiRouter: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  const logger = LoggerFactory.child({ className: 'SystemApiRouter' });

  fastify.get(
    '/system/health',
    {
      schema: {
        tags: ['System'],
        response: {
          200: z.record(z.string(), HealthCheckSchema),
        },
      },
    },
    async (req, res) => {
      const results = await req.serverCtx.healthCheckService.runAll();
      return res.send(results);
    },
  );

  fastify.get(
    '/system/settings',
    {
      schema: {
        tags: ['System', 'Settings'],
        response: {
          200: SystemSettingsResponseSchema,
        },
      },
    },
    async (req, res) => {
      const settings = req.serverCtx.settings.systemSettings();
      return res.send(getSystemSettingsResponse(settings));
    },
  );

  fastify.get(
    '/system/state',
    {
      schema: {
        tags: ['System'],
        response: {
          200: z.object({
            isDocker: z.boolean(),
            isPodman: z.boolean(),
            isInContainer: z.boolean(),
          }),
        },
      },
    },
    async (_, res) => {
      return res.send({
        isDocker: isDocker(),
        isPodman: isPodman(),
        isInContainer: isRunningInContainer(),
      });
    },
  );

  fastify.get(
    '/system/migration-state',
    {
      schema: {
        tags: ['System'],
        response: {
          200: MigrationStateSchema,
        },
      },
    },
    async (req, res) => {
      return res.send(req.serverCtx.settings.migrationState);
    },
  );

  fastify.post(
    '/system/fixers/:fixerId/run',
    {
      schema: {
        tags: ['System'],
        params: z.object({
          fixerId: z.string(),
        }),
      },
    },
    async (req, res) => {
      const fixer = req.serverCtx.fixerRunner.getFixerByName(
        req.params.fixerId,
      );
      if (!fixer) {
        return res
          .status(400)
          .send(`Unknown fixer ${req.params.fixerId} specified`);
      }

      // Someday!
      // await runWorker(
      //   new URL('../tasks/fixers/backfillProgramGroupings', import.meta.url),
      // );

      await fixer.run();

      return res.send();
    },
  );

  fastify.put(
    '/system/settings',
    {
      schema: {
        tags: ['System', 'Settings'],
        body: UpdateSystemSettingsRequestSchema,
        response: {
          200: SystemSettingsResponseSchema,
        },
      },
    },
    async (req, res) => {
      await req.serverCtx.settings.directUpdate((file) => {
        const { system } = file;
        system.logging.useEnvVarLevel =
          req.body.logging?.useEnvVarLevel ?? true;
        if (system.logging.useEnvVarLevel) {
          system.logging.logLevel = getDefaultLogLevel(false);
        } else {
          system.logging.logLevel =
            req.body.logging?.logLevel ?? getDefaultLogLevel(false);
        }

        if (!isUndefined(req.body.backup)) {
          system.backup = req.body.backup;
          scheduleBackupJobs(req.body.backup);
        }

        ifDefined(req.body.cache, (cache) => {
          system.cache = cache;
        });

        ifDefined(req.body.server, (server) => {
          system.server = server;
        });

        return file;
      });

      const refreshedSettings = req.serverCtx.settings.systemSettings();

      return res.send(getSystemSettingsResponse(refreshedSettings));
    },
  );

  fastify.put(
    '/system/settings/backup',
    {
      schema: {
        tags: ['System', 'Settings'],
        body: UpdateBackupSettingsRequestSchema,
        response: {
          200: BackupSettingsSchema,
        },
      },
    },
    async (req, res) => {
      await req.serverCtx.settings.directUpdate((settings) => {
        settings.system.backup = req.body;
        return settings;
      });

      return res.send(
        req.serverCtx.settings.backup as Writable<BackupSettings>,
      );
    },
  );

  fastify.get(
    '/system/debug/nvidia',
    {
      schema: {
        tags: ['System'],
        response: {
          200: z.string(),
        },
      },
    },
    async (req, res) => {
      const smiResult = Result.attemptAsync(() =>
        new ChildProcessHelper().getStdout('nvidia-smi', [], {
          swallowError: true,
          isPath: false,
        }),
      );
      const result = await Promise.all([
        new NvidiaGpuDetectionHelper()
          .getGpuFromFfmpeg(
            req.serverCtx.settings.ffmpegSettings().ffmpegExecutablePath,
          )
          .then((res) =>
            res.either(
              ({ model, architecture, stdout }) =>
                `${JSON.stringify({ model, architecture }, undefined, 4)}\n${stdout}`,
              (err) => err.message,
            ),
          ),
        smiResult.then((_) => _.either(identity, (err) => err.message)),
      ]);

      return res.send(result.join('\n\n'));
    },
  );

  fastify.get(
    '/system/debug/vaapi',
    {
      schema: {
        tags: ['System'],
        response: {
          200: z.string(),
        },
      },
    },
    async (_, res) => {
      const devicesService = container.get(SystemDevicesService);

      const vainfoHelper = new VainfoProcessHelper();
      const results: string[] = [];

      await Promise.all(
        map(devicesService.getDevices() ?? [], async (device) => {
          const result = await vainfoHelper.getVainfoOutput(
            'drm',
            device,
            null,
            false,
          );

          results.push(`Device [${device}]`);
          if (isError(result)) {
            results.push(result.message);
          } else {
            results.push(result);
          }
        }),
      );

      return res.type('text').send(results.join('\n'));
    },
  );

  fastify.get(
    '/system/debug/logs/stream',
    {
      schema: {
        querystring: z.object({
          pretty: z.stringbool().optional().default(false),
        }),
      },
    },
    async (req, res) => {
      const logFilePath = join(
        req.serverCtx.settings.systemSettings().logging.logsDirectory,
        'tunarr.log',
      );

      const tail = new TailFile(logFilePath, {
        objectMode: req.query.pretty,
      });

      await tail
        .on('tail_error', (err) => {
          logger.error(err);
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw err;
        })
        .start();

      let outStream: NodeJS.ReadableStream;
      if (req.query.pretty) {
        const out = new PassThrough();
        const prettyStream: PrettyOptions = {
          ...getPrettyStreamOpts(),
          colorize: false,
          destination: out,
        };

        const pstream = pretty.build(prettyStream);
        tail.pipe(pstream);
        outStream = out;
      } else {
        outStream = tail;
      }

      outStream.on('close', () => {
        tail.quit().catch(console.error);
      });

      return res
        .headers({
          'content-type': req.query.pretty
            ? 'text/plain'
            : 'application/x-ndjson',
          'transfer-encoding': 'chunked',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        .send(outStream);
    },
  );

  fastify.get(
    '/system/debug/logs',
    {
      schema: {
        tags: ['System', 'Logs'],
        querystring: z.object({
          download: TruthyQueryParam.optional(),
          lineLimit: z.coerce.number().positive().optional(),
          pretty: z.stringbool().optional().default(false),
        }),
      },
    },
    async (req, res) => {
      const logFilePath = join(
        req.serverCtx.settings.systemSettings().logging.logsDirectory,
        'tunarr.log',
      );

      if (req.query.download) {
        const gen = req.query.lineLimit
          ? take(streamFileBackwards(logFilePath), req.query.lineLimit)
          : streamFileBackwards(logFilePath);
        let stream = Readable.from(gen).pipe(
          new PassThrough({
            transform(chunk: Buffer, _, callback) {
              this.push(chunk.toString('utf-8') + '\n');
              callback();
            },
          }),
        );

        if (req.query.pretty) {
          const out = new PassThrough();
          const prettyStream: PrettyOptions = {
            ...getPrettyStreamOpts(),
            colorize: false,
            destination: out,
          };
          stream.pipe(pretty.build(prettyStream));
          stream = out;
        }
        return res
          .header('content-type', 'text/plain')
          .header('content-disposition', 'attachment; filename="tunarr.log"')
          .send(stream);
      }

      const stat = await fs.stat(logFilePath);

      const out = new PassThrough({
        transform(chunk: Buffer, _, callback) {
          const str = chunk.toString('utf-8');
          this.push(
            [`event: message`, `data: ${str}`, 'retry: 5000\n\n'].join('\n'),
          );
          callback();
        },
      });

      const onemb = 1024 * 1024;
      const tail = new TailFile(logFilePath, {
        startPos: stat.size > onemb ? stat.size - onemb : 0,
      });

      await tail
        .on('tail_error', (err) => {
          out.end();
          logger.error(err);
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw err;
        })
        .start();

      out.on('close', () => {
        tail.quit().catch(console.error);
      });

      return res
        .headers({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        .send(tail.pipe(split2()).pipe(out));
    },
  );

  fastify.get(
    '/system/debug/env',
    {
      schema: {
        tags: ['System'],
        response: {
          200: z.record(z.string(), z.string()),
        },
      },
    },
    async (_, res) => {
      const matching = seq.collect(
        Object.entries(process.env),
        ([key, val]) => {
          if (key.startsWith('TUNARR_') && val) {
            return [key, val] as const;
          } else if ((key === 'NODE_ENV' || key === 'LOG_LEVEL') && val) {
            return [key, val] as const;
          }
          return;
        },
      );

      return res.send(Object.fromEntries(matching));
    },
  );

  function getSystemSettingsResponse(
    settings: DeepReadonly<SystemSettings>,
  ): SystemSettingsResponse {
    const envLogLevel = getEnvironmentLogLevel();
    return {
      ...(settings as Writable<SystemSettings>),
      dataDirectory: serverOptions().databaseDirectory,
      logging: {
        ...(settings.logging as Writable<LoggingSettings>),
        environmentLogLevel: envLogLevel,
      },
      searchServerAddress: `http://localhost:${container.get<MeilisearchService>(MeilisearchService).getPort()}`,
    };
  }
};
