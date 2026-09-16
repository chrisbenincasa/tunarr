import type { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { KEYS } from '@/types/inject.js';
import { MutexMap } from '@/util/mutexMap.js';
import { Container } from 'inversify';
import { setTestGlobalOptions } from '../testing/getFakeSettingsDb.ts';
import { OnDemandChannelService } from './OnDemandChannelService.ts';

beforeAll(async () => {
  await setTestGlobalOptions();
});

// Mirrors the production container: autobind on, no defaultScope. Inversify's
// default scope is Transient, so an @injectable class that is never explicitly
// bound is resolved fresh at every injection site.
function containerLikeProduction() {
  const container = new Container({ autobind: true });
  container.bind<MutexMap>(KEYS.MutexMap).toDynamicValue(() => new MutexMap());
  container.bind<IChannelDB>(KEYS.ChannelDB).toConstantValue({} as IChannelDB);
  return container;
}

// The service guards every read-modify-write of a channel's onDemandConfig with
// a per-channel lock from #locks. That only serializes anything if every
// consumer shares one instance -- otherwise each holds a private MutexMap and
// locks a channel only against itself. It has three injection sites:
// ServerContext, OnDemandChannelStateTask, and the HlsSession factory in
// StreamModule.
test('resolves to one shared instance so its per-channel locks serialize', () => {
  const container = containerLikeProduction();

  const first = container.get(OnDemandChannelService);
  const second = container.get(OnDemandChannelService);

  expect(first).toBe(second);
});
