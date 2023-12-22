import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { channelsApiV2 } from './channelsApiV2.js';
import { customShowsApiV2 } from './customShowsApiV2.js';
import { plexServerApiV2 } from './plexServersApiV2.js';
import { programmingApi } from './programmingApi.js';
import { tasksApiRouter } from './tasksApi.js';

const registerV2Routes: RouterPluginAsyncCallback = async (f) => {
  await f
    .register(plexServerApiV2)
    .register(tasksApiRouter)
    .register(channelsApiV2)
    .register(customShowsApiV2)
    .register(programmingApi);
};

export default registerV2Routes;
