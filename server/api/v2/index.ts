import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { plexServerApiV2 } from './plexServersApiV2.js';

const registerV2Routes: RouterPluginAsyncCallback = async (f) => {
  await f.register(plexServerApiV2);
};

export default registerV2Routes;
