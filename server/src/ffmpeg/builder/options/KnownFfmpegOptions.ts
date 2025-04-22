export const KnownFfmpegOptions = {
  ReadrateInitialBurst: 'readrate_initial_burst',
  GpuCopy: 'gpu_copy',
} as const;

export const KnownFfmpegFilters = {
  ScaleNpp: 'scale_npp',
  ScaleCuda: 'scale_cuda',
};
