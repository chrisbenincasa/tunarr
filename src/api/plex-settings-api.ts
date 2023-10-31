import express from 'express';
import createLogger from '../logger.js';
import { firstDefined } from '../util.js';

const logger = createLogger(import.meta);

export const plexSettingsRouter = express.Router();

plexSettingsRouter.get('/api/plex-settings', (req, res) => {
  try {
    let plex = req.ctx.db['plex-settings'].find()[0];
    res.send(plex);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});
plexSettingsRouter.put('/api/plex-settings', (req, res) => {
  try {
    req.ctx.db['plex-settings'].update({ _id: req.body._id }, req.body);
    let plex = req.ctx.db['plex-settings'].find()[0];
    res.send(plex);
    req.ctx.eventService.push('settings-update', {
      message: 'Plex configuration updated.',
      module: 'plex',
      detail: {
        action: 'update',
      },
      level: 'info',
    });
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
    req.ctx.eventService.push('settings-update', {
      message: 'Error updating Plex configuration',
      module: 'plex',
      detail: {
        action: 'update',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});
plexSettingsRouter.post('/api/plex-settings', (req, res) => {
  // RESET
  try {
    req.ctx.db['plex-settings'].update(
      { _id: req.body._id },
      {
        streamPath: 'plex',
        debugLogging: true,
        directStreamBitrate: '20000',
        transcodeBitrate: '2000',
        mediaBufferSize: 1000,
        transcodeMediaBufferSize: 20000,
        maxPlayableResolution: '1920x1080',
        maxTranscodeResolution: '1920x1080',
        videoCodecs: 'h264,hevc,mpeg2video,av1',
        audioCodecs: 'ac3',
        maxAudioChannels: '2',
        audioBoost: '100',
        enableSubtitles: false,
        subtitleSize: '100',
        updatePlayStatus: false,
        streamProtocol: 'http',
        forceDirectPlay: false,
        pathReplace: '',
        pathReplaceWith: '',
      },
    );
    let plex = req.ctx.db['plex-settings'].find()[0];
    res.send(plex);
    req.ctx.eventService.push('settings-update', {
      message: 'Plex configuration reset.',
      module: 'plex',
      detail: {
        action: 'reset',
      },
      level: 'warning',
    });
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');

    req.ctx.eventService.push('settings-update', {
      message: 'Error reseting Plex configuration',
      module: 'plex',
      detail: {
        action: 'reset',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});
