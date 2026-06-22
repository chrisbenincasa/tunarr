import { ChannelDB } from '@/db/ChannelDB.js';
import { ProgramDB } from '@/db/ProgramDB.js';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { KEYS } from '@/types/inject.js';
import type { Factory } from 'inversify';
import { ContainerModule } from 'inversify';
import type { Kysely } from 'kysely';
import { DBAccess } from './DBAccess.ts';
import { FillerDB } from './FillerListDB.ts';
import { ProgramPlayHistoryDB } from './ProgramPlayHistoryDB.ts';
import { BasicChannelRepository } from './channel/BasicChannelRepository.ts';
import { ChannelConfigRepository } from './channel/ChannelConfigRepository.ts';
import { ChannelProgramRepository } from './channel/ChannelProgramRepository.ts';
import { ChannelReadOpsRepository } from './channel/ChannelReadOpsRepository.ts';
import { LineupRepository } from './channel/LineupRepository.ts';
import { ProgramGroupingMinter } from './converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from './converters/ProgramMinter.ts';
import { BasicProgramRepository } from './program/BasicProgramRepository.ts';
import { ProgramExternalIdRepository } from './program/ProgramExternalIdRepository.ts';
import { ProgramGroupingRepository } from './program/ProgramGroupingRepository.ts';
import { ProgramGroupingUpsertRepository } from './program/ProgramGroupingUpsertRepository.ts';
import { ProgramMetadataRepository } from './program/ProgramMetadataRepository.ts';
import { ProgramSearchRepository } from './program/ProgramSearchRepository.ts';
import { ProgramStateRepository } from './program/ProgramStateRepository.ts';
import { ProgramUpsertRepository } from './program/ProgramUpsertRepository.ts';
import type { DB } from './schema/db.ts';
import type { DrizzleDBAccess } from './schema/index.ts';

const DBModule = new ContainerModule(({ bind }) => {
  // ProgramDB sub-repositories (must be registered before ProgramDB itself)
  bind(KEYS.BasicProgramRepository)
    .to(BasicProgramRepository)
    .inSingletonScope();
  bind(KEYS.ProgramGroupingRepository)
    .to(ProgramGroupingRepository)
    .inSingletonScope();
  bind(KEYS.ProgramExternalIdRepository)
    .to(ProgramExternalIdRepository)
    .inSingletonScope();
  bind(KEYS.ProgramMetadataRepository)
    .to(ProgramMetadataRepository)
    .inSingletonScope();
  bind(KEYS.ProgramGroupingUpsertRepository)
    .to(ProgramGroupingUpsertRepository)
    .inSingletonScope();
  bind(KEYS.ProgramSearchRepository)
    .to(ProgramSearchRepository)
    .inSingletonScope();
  bind(KEYS.ProgramStateRepository)
    .to(ProgramStateRepository)
    .inSingletonScope();
  bind(KEYS.ProgramUpsertRepository)
    .to(ProgramUpsertRepository)
    .inSingletonScope();

  // ChannelDB sub-repositories (must be registered before ChannelDB itself)
  // LineupRepository must come before BasicChannelRepository (it's injected into it)
  bind(KEYS.LineupRepository).to(LineupRepository).inSingletonScope();
  bind(KEYS.ChannelConfigRepository)
    .to(ChannelConfigRepository)
    .inSingletonScope();
  bind(KEYS.ChannelProgramRepository)
    .to(ChannelProgramRepository)
    .inSingletonScope();
  bind(KEYS.BasicChannelRepository)
    .to(BasicChannelRepository)
    .inSingletonScope();
  bind(KEYS.ChannelReadOpsRepository)
    .to(ChannelReadOpsRepository)
    .inSingletonScope();

  // Main DB facades
  bind<IProgramDB>(KEYS.ProgramDB).to(ProgramDB).inSingletonScope();
  bind<IChannelDB>(KEYS.ChannelDB).to(ChannelDB).inSingletonScope();
  bind<DBAccess>(DBAccess).toSelf().inSingletonScope();
  bind<Kysely<DB>>(KEYS.Database).toDynamicValue(
    (ctx) => ctx.get(DBAccess).db!,
  );
  bind<DrizzleDBAccess>(KEYS.DrizzleDB).toDynamicValue(
    (ctx) => ctx.get(DBAccess).drizzle!,
  );
  bind<Factory<Kysely<DB>>>(KEYS.DatabaseFactory).toFactory(
    (ctx) => () => ctx.get<Kysely<DB>>(KEYS.Database),
  );
  bind<Factory<DrizzleDBAccess>>(KEYS.DrizzleDatabaseFactory).toFactory(
    (ctx) => () => ctx.get<DrizzleDBAccess>(KEYS.DrizzleDB),
  );
  bind(KEYS.FillerListDB).to(FillerDB).inSingletonScope();
  bind(ProgramPlayHistoryDB).toSelf().inSingletonScope();

  bind(ProgramGroupingMinter).toSelf().inSingletonScope();
  bind(ProgramDaoMinter).toSelf();
  bind<Factory<ProgramDaoMinter>>(KEYS.ProgramDaoMinterFactory).toFactory(
    (ctx) => () => ctx.get<ProgramDaoMinter>(ProgramDaoMinter),
  );
});

export { DBModule as dbContainer };
