import { FfmpegInfoResponse } from '@tunarr/types/api';
import { makeEndpoint } from '@tunarr/zodios-core';

export const getFfmpegInfoEndpoint = makeEndpoint({
  method: 'get',
  path: '/api/ffmpeg-info',
  response: FfmpegInfoResponse,
  alias: 'getFfmpegInfo',
});
