import { ChannelDB } from '@/db/ChannelDB.js';
import { ProgramDB } from '@/db/ProgramDB.js';
import { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { KEYS } from '@/types/inject.js';
import { ContainerModule } from 'inversify';

const DBModule = new ContainerModule((bind) => {
  bind<IProgramDB>(KEYS.ProgramDB).to(ProgramDB).inSingletonScope();
  bind<IChannelDB>(KEYS.ChannelDB).to(ChannelDB).inSingletonScope();
});

export { DBModule as dbContainer };
