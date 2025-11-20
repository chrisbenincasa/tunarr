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
  DrizzleDB: Symbol.for('DrizzleDB'),
  DatabaseFactory: Symbol.for('DatabaseFactory'),
  DrizzleDatabaseFactory: Symbol.for('DrizzleDatabaseFactory'),
  ChannelDB: Symbol.for('ChannelDB'),
  ProgramDB: Symbol.for('ProgramDB'),
  FillerListDB: Symbol.for('FillerListDB'),
  SettingsDB: Symbol.for('SettingsDB'),
  MediaSourceApiFactory: Symbol.for('MediaSourceApiFactory'),
  TimeSlotSchedulerServiceFactory: Symbol.for(
    'TimeSlotSchedulerServiceFactory',
  ),
  MediaSourceLibraryRefresher: Symbol.for('MediaSourceLibraryRefresher'),
  ProgramDaoMinterFactory: Symbol.for('ProgramDaoMinterFactory'),

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
  StartupTask: Symbol.for('StartupTask'),
  Fixer: Symbol.for('Fixer'),
  WorkerPool: Symbol.for('WorkerPool'),
  WorkerPoolFactory: Symbol.for('WorkerPoolFactory'),
  PlexCanonicalizer: Symbol.for('PlexCanonicalizer'),
  JellyfinCanonicalizer: Symbol.for('JellyfinCanonicalizer'),
  EmbyCanonicalizer: Symbol.for('EmbyCanonicalizer'),
  LocalFolderCanonicalizer: Symbol.for('LocalFolderCanonicalizer'),
  LocalMediaCanonicalizer: Symbol.for('LocalMediaCanonicalizer'),
  ContentSourceUpdateFactory: Symbol.for('ContentSourceUpdateFactory'),

  FillerPicker: Symbol.for('FillerPicker'),
  ChannelCache: Symbol.for('ChannelCache'),
  SearchService: Symbol.for('SearchService'),
  PlexApiClientFactory: Symbol.for('PlexApiClientFactory'),
  JellyfinApiClientFactory: Symbol.for('JellyfinApiClientFactory'),
  EmbyApiClientFactory: Symbol.for('EmbyApiClientFactory'),
  MediaSourceMovieLibraryScanner: Symbol.for('MediaSourceMovieLibraryScanner'),
  MediaSourceTvShowLibraryScanner: Symbol.for(
    'MediaSourceTvShowLibraryScanner',
  ),
  MediaSourceMusicLibraryScanner: Symbol.for('MediaSourceMusicLibraryScanner'),
  MediaSourceOtherVideoLibraryScanner: Symbol.for(
    'MediaSourceOtherVideoLibraryScanner',
  ),
  MediaSourceLibraryScanner: Symbol.for('MediaSourceLibraryScanner'),
  LocalMediaSourceScanner: Symbol.for('LocalMediaSourceScanner'),

  // Tasks
  Task: Symbol.for('Task'),
  StartupTasks: Symbol.for('StartupTasks'),
};

export type LoggerFactory = (args: GetChildLoggerArgs) => Logger;

export { KEYS };
