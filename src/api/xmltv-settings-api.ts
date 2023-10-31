import express from 'express';
import createLogger from '../logger.js';
import { serverOptions } from '../globals.js';
import { firstDefined } from '../util.js';
import { xmltvInterval } from '../xmltv-generator.js';

const logger = createLogger(import.meta);

export const xmlTvSettingsRouter = express.Router();

xmlTvSettingsRouter.get('/api/xmltv-settings', async (req, res) => {
  try {
    res.json(req.ctx.dbAccess.xmlTvSettings());
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

xmlTvSettingsRouter.put('/api/xmltv-settings', async (req, res) => {
  try {
    let xmltv = req.ctx.db['xmltv-settings'].find()[0];
    req.ctx.db['xmltv-settings'].update(
      { _id: req.body._id },
      {
        _id: req.body._id,
        cache: req.body.cache,
        refresh: req.body.refresh,
        enableImageCache: req.body.enableImageCache === true,
        file: xmltv.file,
      },
    );
    xmltv = req.ctx.db['xmltv-settings'].find()[0];
    res.send(xmltv);
    req.ctx.eventService.push('settings-update', {
      message: 'xmltv settings updated.',
      module: 'xmltv',
      detail: {
        action: 'update',
      },
      level: 'info',
    });
    updateXmltv();
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');

    req.ctx.eventService.push('settings-update', {
      message: 'Error updating xmltv configuration',
      module: 'xmltv',
      detail: {
        action: 'update',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});

xmlTvSettingsRouter.post('/api/xmltv-settings', (req, res) => {
  try {
    req.ctx.db['xmltv-settings'].update(
      { _id: req.body._id },
      {
        _id: req.body._id,
        cache: 12,
        refresh: 4,
        file: serverOptions().database + '/xmltv.xml',
      },
    );
    var xmltv = req.ctx.db['xmltv-settings'].find()[0];
    res.send(xmltv);
    req.ctx.eventService.push('settings-update', {
      message: 'xmltv settings reset.',
      module: 'xmltv',
      detail: {
        action: 'reset',
      },
      level: 'warning',
    });

    updateXmltv();
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
    req.ctx.eventService.push('settings-update', {
      message: 'Error reseting xmltv configuration',
      module: 'xmltv',
      detail: {
        action: 'reset',
        error: firstDefined(err, 'message'),
      },
      level: 'danger',
    });
  }
});

function updateXmltv() {
  xmltvInterval.updateXML();
  xmltvInterval.restartInterval();
}
