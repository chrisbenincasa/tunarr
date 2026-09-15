export const KnownFfmpegOptions = {
  ReadrateInitialBurst: 'readrate_initial_burst',
  GpuCopy: 'gpu_copy',
} as const;

// Fixed reference peak (nits) used by tonemap filters that support a
// `peak` override. Without this, ffmpeg re-derives the peak from each
// frame's mastering-display/CLL side data, which can change scene-to-scene
// on some HDR10 encodes and cause the tone curve to visibly re-anchor at
// cuts. A static value trades per-title accuracy for a stable image.
// TODO: derive this per-title from probed mastering-display/CLL metadata
// (not currently captured by ffprobe parsing) and fall back to this
// constant when absent.
export const DefaultTonemapPeakNits = 1000;

export const KnownFfmpegFilters = {
  ScaleNpp: 'scale_npp',
  ScaleCuda: 'scale_cuda',
  ScaleVulkan: 'scale_vulkan',
  TonemapVaapi: 'tonemap_vaapi',
  TonemapOpencl: 'tonemap_opencl',
  Libplacebo: 'libplacebo',
  PadVaapi: 'pad_vaapi',
  PadOpencl: 'pad_opencl',
  OverlayQsv: 'overlay_qsv',
};
