import path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

import { isUndefined, join } from 'lodash-es';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { isProduction } from './util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getLabel = (callingModule: ImportMeta) => {
  const parts = callingModule.url.split(path.sep);
  return path.join(parts[parts.length - 2], parts.pop() ?? '');
};

const hformat = (module: ImportMeta) => {
  // Exclude module label in prod build because it will always be the same (bundle.js)
  const moduleLabel = isProduction ? '' : ` ${getLabel(module)}`;
  return winston.format.printf(
    ({ level, label, message, timestamp, ...metadata }) => {
      let msg = `${timestamp} [${level}]${moduleLabel}${
        label ? `[${label}]` : ''
      }: ${message} `;
      for (const key of Object.keys(metadata)) {
        if (key === 'stack') {
          msg += metadata.message;
          if (metadata.stack) {
            msg += '\n';
            msg += join(
              metadata.stack.split('\n').map((line) => '\t' + line),
              '\n',
            );
          }
        } else if (isUndefined(metadata)) {
          msg += chalk.gray('undefined');
        }
      }
      return msg;
    },
  );
};

const createLogger = (module: ImportMeta) => {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL?.toLowerCase() || 'debug',
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.timestamp(),
      hformat(module),
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.splat(),
          winston.format.timestamp(),
          hformat(module),
        ),
      }),
      new winston.transports.DailyRotateFile({
        filename: process.env.CONFIG_DIRECTORY
          ? `${process.env.CONFIG_DIRECTORY}/logs/dizquetv-%DATE%.log`
          : path.join(__dirname, '../config/logs/dizquetv-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '7d',
        createSymlink: true,
        symlinkName: 'dizquetv.log',
      }),
      new winston.transports.DailyRotateFile({
        filename: process.env.CONFIG_DIRECTORY
          ? `${process.env.CONFIG_DIRECTORY}/logs/.machinelogs-%DATE%.json`
          : path.join(__dirname, '../config/logs/.machinelogs-%DATE%.json'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '1d',
        createSymlink: true,
        symlinkName: '.machinelogs.json',
        format: winston.format.combine(
          winston.format.splat(),
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  });

  if (process.env.LOG_LEVEL) {
    logger.level = process.env.LOG_LEVEL;
  }

  return logger;
};

export default createLogger;
