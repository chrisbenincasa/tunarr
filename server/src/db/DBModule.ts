import { ChannelDB } from '@/db/ChannelDB.js';
import { ProgramDB } from '@/db/ProgramDB.js';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { KEYS } from '@/types/inject.js';
import type { interfaces } from 'inversify';
import { ContainerModule } from 'inversify';
import type { Kysely } from 'kysely';
import { DBAccess } from './DBAccess.ts';
import type { DB } from './schema/db.ts';

const DBModule = new ContainerModule((bind) => {
  bind<IProgramDB>(KEYS.ProgramDB).to(ProgramDB).inSingletonScope();
  bind<IChannelDB>(KEYS.ChannelDB).to(ChannelDB).inSingletonScope();
  bind<DBAccess>(DBAccess).toSelf().inSingletonScope();
  bind<Kysely<DB>>(KEYS.Database)
    .toDynamicValue((ctx) => ctx.container.get(DBAccess).db!)
    .whenTargetIsDefault();
  bind<interfaces.Factory<Kysely<DB>>>(KEYS.DatabaseFactory).toAutoFactory(
    KEYS.Database,
  );
});

export { DBModule as dbContainer };
