import { ChannelDB } from '@/db/ChannelDB.js';
import { ProgramDB } from '@/db/ProgramDB.js';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { KEYS } from '@/types/inject.js';
import type { interfaces } from 'inversify';
import { ContainerModule } from 'inversify';
import type { Kysely } from 'kysely';
import { DBAccess } from './DBAccess.ts';
import { FillerDB } from './FillerListDB.ts';
import { ProgramPlayHistoryDB } from './ProgramPlayHistoryDB.ts';
import { ProgramDaoMinter } from './converters/ProgramMinter.ts';
import type { DB } from './schema/db.ts';
import type { DrizzleDBAccess } from './schema/index.ts';
import { BasicProgramRepository } from './program/BasicProgramRepository.ts';
import { ProgramGroupingRepository } from './program/ProgramGroupingRepository.ts';
import { ProgramExternalIdRepository } from './program/ProgramExternalIdRepository.ts';
import { ProgramUpsertRepository } from './program/ProgramUpsertRepository.ts';
import { ProgramMetadataRepository } from './program/ProgramMetadataRepository.ts';
import { ProgramGroupingUpsertRepository } from './program/ProgramGroupingUpsertRepository.ts';
import { ProgramSearchRepository } from './program/ProgramSearchRepository.ts';
import { ProgramStateRepository } from './program/ProgramStateRepository.ts';
import { BasicChannelRepository } from './channel/BasicChannelRepository.ts';
import { ChannelProgramRepository } from './channel/ChannelProgramRepository.ts';
import { LineupRepository } from './channel/LineupRepository.ts';
import { ChannelConfigRepository } from './channel/ChannelConfigRepository.ts';

const DBModule = new ContainerModule((bind) => {
  // ProgramDB sub-repositories (must be registered before ProgramDB itself)
  bind(KEYS.BasicProgramRepository).to(BasicProgramRepository).inSingletonScope();
  bind(KEYS.ProgramGroupingRepository).to(ProgramGroupingRepository).inSingletonScope();
  bind(KEYS.ProgramExternalIdRepository).to(ProgramExternalIdRepository).inSingletonScope();
  bind(KEYS.ProgramMetadataRepository).to(ProgramMetadataRepository).inSingletonScope();
  bind(KEYS.ProgramGroupingUpsertRepository).to(ProgramGroupingUpsertRepository).inSingletonScope();
  bind(KEYS.ProgramSearchRepository).to(ProgramSearchRepository).inSingletonScope();
  bind(KEYS.ProgramStateRepository).to(ProgramStateRepository).inSingletonScope();
  bind(KEYS.ProgramUpsertRepository).to(ProgramUpsertRepository).inSingletonScope();

  // ChannelDB sub-repositories (must be registered before ChannelDB itself)
  // LineupRepository must come before BasicChannelRepository (it's injected into it)
  bind(KEYS.LineupRepository).to(LineupRepository).inSingletonScope();
  bind(KEYS.ChannelConfigRepository).to(ChannelConfigRepository).inSingletonScope();
  bind(KEYS.ChannelProgramRepository).to(ChannelProgramRepository).inSingletonScope();
  bind(KEYS.BasicChannelRepository).to(BasicChannelRepository).inSingletonScope();

  // Main DB facades
  bind<IProgramDB>(KEYS.ProgramDB).to(ProgramDB).inSingletonScope();
  bind<IChannelDB>(KEYS.ChannelDB).to(ChannelDB).inSingletonScope();
  bind<DBAccess>(DBAccess).toSelf().inSingletonScope();
  bind<Kysely<DB>>(KEYS.Database)
    .toDynamicValue((ctx) => ctx.container.get(DBAccess).db!)
    .whenTargetIsDefault();
  bind<DrizzleDBAccess>(KEYS.DrizzleDB)
    .toDynamicValue((ctx) => ctx.container.get(DBAccess).drizzle!)
    .whenTargetIsDefault();
  bind<interfaces.Factory<Kysely<DB>>>(KEYS.DatabaseFactory).toAutoFactory(
    KEYS.Database,
  );
  bind<interfaces.Factory<DrizzleDBAccess>>(
    KEYS.DrizzleDatabaseFactory,
  ).toAutoFactory(KEYS.DrizzleDB);
  bind(KEYS.FillerListDB).to(FillerDB).inSingletonScope();
  bind(ProgramPlayHistoryDB).toSelf().inSingletonScope();

  bind(ProgramDaoMinter).toSelf();
  bind<interfaces.AutoFactory<ProgramDaoMinter>>(
    KEYS.ProgramDaoMinterFactory,
  ).toAutoFactory<ProgramDaoMinter>(ProgramDaoMinter);
});

export { DBModule as dbContainer };
