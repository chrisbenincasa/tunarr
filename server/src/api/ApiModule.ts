import { ContainerModule } from 'inversify';
import { KEYS } from '../types/inject.ts';
import { FfmpegSettingsController } from './FfmpegSettingsController.ts';
import { HdhrSettingsController } from './hdhrSettingsApi.ts';
import { XmlTvSettingsController } from './xmltvSettingsApi.ts';

export const ApiModule = new ContainerModule((bind) => {
  bind(KEYS.ApiController).to(XmlTvSettingsController);
  bind(KEYS.ApiController).to(HdhrSettingsController);
  bind(KEYS.ApiController).to(FfmpegSettingsController);
});
