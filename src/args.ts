import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import constants from './constants.js';

export const argv = yargs(hideBin(process.argv))
  .scriptName('dizquetv')
  .option('port', {
    alias: 'p',
    type: 'number',
    desc: 'The port to run the dizque server on',
    default: 8000,
  })
  .option('database', {
    alias: 'd',
    type: 'string',
    desc: 'Path to the database directory',
    default: path.join('.', constants.DEFAULT_DATA_DIR),
    normalize: true,
  })
  // .coerce('database', path.resolve)
  .parseSync();
