import type { ServerType } from '@/types/serverType.js';
import { Logger } from '@/util/logging/LoggerFactory.js';
import type { HdhrSettings } from '@tunarr/types';
import { BaseErrorSchema } from '@tunarr/types/api';
import { HdhrSettingsSchema } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import { isError } from 'lodash-es';
import type { DeepWritable } from 'ts-essentials';
import { KEYS } from '../types/inject.ts';
import { Controller } from './Controller.ts';

@injectable()
export class HdhrSettingsController extends Controller {
  protected prefix = '/settings/hdhr';
  protected tags = ['Settings'];

  constructor(@inject(KEYS.Logger) logger: Logger) {
    super(logger);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async configure(fastify: ServerType): Promise<void> {
    fastify.get(
      '',
      {
        schema: {
          response: {
            200: HdhrSettingsSchema,
            500: BaseErrorSchema,
          },
        },
      },
      async (req, res) => {
        const hdhr = req.serverCtx.settings.hdhrSettings();
        return res.send(hdhr as DeepWritable<HdhrSettings>);
      },
    );

    fastify.put(
      '',
      {
        onResponse: (req, _, done) => {
          req.serverCtx.eventService.push({
            type: 'settings-update',
            message: 'HDHR configuration updated.',
            module: 'hdhr',
            detail: {
              action: 'update',
            },
            level: 'success',
          });
          done();
        },
        onError: (req, _, err, done) => {
          req.serverCtx.eventService.push({
            type: 'settings-update',
            message: 'Error updating HDHR configuration',
            module: 'hdhr',
            detail: {
              action: 'action',
              error: isError(err) ? err.message : 'unknown',
            },
            level: 'error',
          });
          done();
        },
        schema: {
          body: HdhrSettingsSchema,
          response: {
            200: HdhrSettingsSchema,
            500: BaseErrorSchema,
          },
        },
      },
      async (req, res) => {
        await req.serverCtx.settings.updateSettings('hdhr', req.body);
        const hdhr = req.serverCtx.settings.hdhrSettings();
        await res.send(hdhr);
      },
    );

    fastify.post(
      '',
      {
        onResponse: (req, _, done) => {
          req.serverCtx.eventService.push({
            type: 'settings-update',
            message: 'HDHR configuration reset.',
            module: 'hdhr',
            detail: {
              action: 'reset',
            },
            level: 'warning',
          });
          done();
        },
        onError: (req, _, err, done) => {
          req.serverCtx.eventService.push({
            type: 'settings-update',
            message: 'Error reseting HDHR configuration',
            module: 'hdhr',
            detail: {
              action: 'reset',
              error: isError(err) ? err.message : 'unknown',
            },
            level: 'error',
          });
          done();
        },
        schema: {
          response: {
            200: HdhrSettingsSchema,
            500: BaseErrorSchema,
          },
        },
      },
      async (req, res) => {
        await req.serverCtx.settings.updateSettings('hdhr', {
          tunerCount: 1,
          autoDiscoveryEnabled: true,
        });
        const hdhr =
          req.serverCtx.settings.hdhrSettings() as DeepWritable<HdhrSettings>;
        return res.send(hdhr);
      },
    );
  }
}
