import path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getLabel = (callingModule: ImportMeta) => {
  const parts = callingModule.url.split(path.sep);
  return path.join(parts[parts.length - 2], parts.pop() ?? '');
};

const hformat = (module: ImportMeta) =>
  winston.format.printf(({ level, label, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${getLabel(module)}${
      label ? `[${label}]` : ''
    }: ${message} `;
    if (Object.keys(metadata).length > 0) {
      msg += JSON.stringify(metadata);
    }
    return msg;
  });

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
