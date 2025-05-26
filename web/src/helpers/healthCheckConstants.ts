// TODO: Get these from server.
export const MissingSeasonNumbersCheck = 'MissingSeasonNumbers';
export const FfmpegVersionCheck = 'FfmpegVersion';
export const HardwareAccelerationCheck = 'HardwareAcceleration';
export const FfmpegDebugLoggingCheck = 'FfmpegDebugLogging';
export const MissingProgramAssociationsHealthCheck =
  'MissingProgramAssociationsHealthCheck';
export const FfmpegTranscodeDirectory = 'FfmpegTranscodeDirectory';
export const AllKnownChecks = [
  FfmpegVersionCheck,
  HardwareAccelerationCheck,
  FfmpegTranscodeDirectory,
  FfmpegDebugLoggingCheck,
  MissingSeasonNumbersCheck,
  MissingProgramAssociationsHealthCheck,
] as const;
