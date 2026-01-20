import type { RouterPluginAsyncCallback } from '../types/serverType.js';

export interface ApiController {
  mount: RouterPluginAsyncCallback;
}
