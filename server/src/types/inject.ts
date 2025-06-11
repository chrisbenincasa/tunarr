import type {
  GetChildLoggerArgs,
  Logger,
} from '@/util/logging/LoggerFactory.js';

const KEYS = {
  GlobalOptions: Symbol.for('GlobalOptions'),
  ServerOptions: Symbol.for('ServerOptions'),

  Logger: Symbol.for('Logger'),
  LoggerFactory: Symbol.for('LoggerFactory'),
  RootLogger: Symbol.for('RootLogger'),
  Timer: Symbol.for('Timer'),
  MutexMap: Symbol.for('MutexMap'),

  Database: Symbol.for('Database'),
  DatabaseFactory: Symbol.for('DatabaseFactory'),
  ChannelDB: Symbol.for('ChannelDB'),
  ProgramDB: Symbol.for('ProgramDB'),
  SettingsDB: Symbol.for('SettingsDB'),
  MediaSourceApiFactory: Symbol.for('MediaSourceApiFactory'),
  TimeSlotSchedulerServiceFactory: Symbol.for(
    'TimeSlotSchedulerServiceFactory',
  ),

  // Streaming
  HlsSession: Symbol.for('HlsSession'),
  HlsSlowerSession: Symbol.for('HlsSlowerSession'),
  ConcatSession: Symbol.for('ConcatSession'),
  HlsSessionProvder: Symbol.for('HlsSessionProvider'),
  ProgramStreamFactory: Symbol.for('Factory<ProgramStream>'),
  JellyfinStreamDetails: Symbol.for('JellyfinStreamDetails'),
  JellyfinStreamDetailsFactory: Symbol.for('JellyfinStreamDetailsFactory'),
  PlexStreamDetails: Symbol.for('PlexStreamDetails'),
  PlexStreamDetailsFactory: Symbol.for('PlexStreamDetailsFactory'),
  EmbyStreamDetails: Symbol.for('EmbyStreamDetails'),
  EmbyStreamDetailsFactory: Symbol.for('EmbyStreamDetailsFactory'),
  FFmpegFactory: Symbol.for('FFmpegFactory'),
  ConcatStreamFactory: Symbol.for('ConcatStreamFactory'),
  PipelineBuilderFactory: Symbol.for('PipelineBuilderFactory'),
  UpdateXmlTvTaskFactory: Symbol.for('Factory<UpdateXmlTvTask>'),

  // Services
  HealthCheck: Symbol.for('HealthCheck'),
  Fixer: Symbol.for('Fixer'),
  WorkerPool: Symbol.for('WorkerPool'),

  ContentSourceUpdateFactory: Symbol.for('ContentSourceUpdateFactory'),
};

export type LoggerFactory = (args: GetChildLoggerArgs) => Logger;

export { KEYS };
