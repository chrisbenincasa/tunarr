import * as kc from 'kysely-codegen';

import { FileCacheAdapter } from '@mikro-orm/better-sqlite';
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
const { connectionString } = connectionStringParser.parse({
  connectionString: config.get('dbName'),
  // dialectName: options.dialectName,
  // envFile: options.envFile,
  logger,
});

class CustomSqliteAdapter extends kc.SqliteAdapter {
  override readonly scalars = {
    any: new kc.IdentifierNode('unknown'),
    blob: new kc.IdentifierNode('Buffer'),
    boolean: new kc.IdentifierNode('number'),
    integer: new kc.IdentifierNode('number'),
    numeric: new kc.IdentifierNode('number'),
    datetime: new kc.IdentifierNode('number'),
    real: new kc.IdentifierNode('number'),
    text: new kc.IdentifierNode('string'),
  };
}
class CustomSqliteDialect extends kc.SqliteDialect {
  adapter: kc.SqliteAdapter = new CustomSqliteAdapter();
}

const cli = new kc.Cli();
const optsFromCli = cli.parseOptions(process.argv);
// await cli.generate({
//   ...optsFromCli,
//   url: config.get('dbName'),

//   overrides: {
//     columns: {
//       'program_grouping.created_at': new kc.RawExpressionNode('number'),
//     },
//   },
// });

const dialect = new CustomSqliteDialect();
const db = await dialect.introspector.connect({ connectionString, dialect });

await kc.generate({
  ...optsFromCli,
  camelCase: true,
  outFile: 'src/dao/direct/types.gen.d.ts',
  dialect,
  db,
});

await db.destroy();

// if (options.dialectName) {
//   logger.info(`Using dialect '${options.dialectName}'.`);
// } else {
// }
