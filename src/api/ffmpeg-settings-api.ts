import express from 'express';
import createLogger from '../logger.js';
import { firstDefined } from '../util.js';
import * as databaseMigration from '../database-migration.js';
import { isUndefined } from 'lodash-es';

const logger = createLogger(import.meta);

export const ffmpegSettingsRouter = express.Router();

ffmpegSettingsRouter.get('/api/ffmpeg-settings', (req, res) => {
  try {
    let ffmpeg = req.ctx.db['ffmpeg-settings'].find()[0];
    res.send(ffmpeg);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
ffmpegSettingsRouter.put('/api/ffmpeg-settings', (req, res) => {
  try {
    req.ctx.db['ffmpeg-settings'].update({ _id: req.body._id }, req.body);
    let ffmpeg = req.ctx.db['ffmpeg-settings'].find()[0];
    let err = fixupFFMPEGSettings(ffmpeg);
    if (typeof err !== 'undefined') {
      res.status(400).send(err);
    }
    req.ctx.eventService.push('settings-update', {
      message: 'FFMPEG configuration updated.',
      module: 'ffmpeg',
      detail: {
        action: 'update',
      },
      level: 'info',
    });
    res.send(ffmpeg);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
    req.ctx.eventService.push('settings-update', {
      message: 'Error updating FFMPEG configuration.',
      module: 'ffmpeg',
      detail: {
        action: 'update',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});
ffmpegSettingsRouter.post('/api/ffmpeg-settings', (req, res) => {
  // RESET
  try {
    let ffmpeg = databaseMigration.ffmpeg();
    ffmpeg.ffmpegPath = req.body.ffmpegPath;
    req.ctx.db['ffmpeg-settings'].update({ _id: req.body._id }, ffmpeg);
    ffmpeg = req.ctx.db['ffmpeg-settings'].find()[0];
    req.ctx.eventService.push('settings-update', {
      message: 'FFMPEG configuration reset.',
      module: 'ffmpeg',
      detail: {
        action: 'reset',
      },
      level: 'warning',
    });
    res.send(ffmpeg);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
    req.ctx.eventService.push('settings-update', {
      message: 'Error reseting FFMPEG configuration.',
      module: 'ffmpeg',
      detail: {
        action: 'reset',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});

function fixupFFMPEGSettings(ffmpeg): string | undefined {
  if (isUndefined(ffmpeg.maxFPS)) {
    ffmpeg.maxFPS = 60;
  } else if (isNaN(ffmpeg.maxFPS)) {
    return 'maxFPS should be a number';
  }
  return void 0;
}
