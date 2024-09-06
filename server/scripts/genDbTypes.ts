import * as kc from 'kysely-codegen';

import {
  FileCacheAdapter,
  MetadataDiscovery,
  MetadataStorage,
  colors,
} from '@mikro-orm/better-sqlite';
import { CLIHelper } from '@mikro-orm/cli';

// This is really hacky but I'm tired of dealing with ts-node

const config = await CLIHelper.getConfiguration(true, {
  metadataCache: {
    enabled: true,
    adapter: FileCacheAdapter,
    options: {
      combined: './metadata.json',
    },
  },
});

console.log(config.get('dbName'));
const logger = new kc.Logger(kc.DEFAULT_LOG_LEVEL);

const connectionStringParser = new kc.ConnectionStringParser();
const { connectionString, inferredDialectName } = connectionStringParser.parse({
  connectionString: config.get('dbName'),
  // dialectName: options.dialectName,
  // envFile: options.envFile,
  logger,
});

// if (options.dialectName) {
//   logger.info(`Using dialect '${options.dialectName}'.`);
// } else {
// }
logger.info(`No dialect specified. Assuming '${inferredDialectName}'.`);
