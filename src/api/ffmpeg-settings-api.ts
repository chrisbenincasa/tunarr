import express from 'express';
import { isUndefined } from 'lodash-es';
import { defaultFfmpegSettings } from '../dao/db.js';
import createLogger from '../logger.js';
import { firstDefined } from '../util.js';

const logger = createLogger(import.meta);

export const ffmpegSettingsRouter = express.Router();

ffmpegSettingsRouter.get('/api/ffmpeg-settings', (req, res) => {
  try {
    let ffmpeg = req.ctx.dbAccess.ffmpegSettings();
    res.send(ffmpeg);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
ffmpegSettingsRouter.put('/api/ffmpeg-settings', async (req, res) => {
  try {
    await req.ctx.dbAccess.updateSettings('ffmpeg', req.body);
    let ffmpeg = req.ctx.dbAccess.ffmpegSettings();
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

ffmpegSettingsRouter.post('/api/ffmpeg-settings', async (req, res) => {
  // RESET
  try {
    let ffmpeg = { ...defaultFfmpegSettings };
    ffmpeg.ffmpegExecutablePath = req.body.ffmpegPath;
    await req.ctx.dbAccess.updateFfmpegSettings(ffmpeg);
    ffmpeg = req.ctx.dbAccess.ffmpegSettings();
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
