import fs from 'node:fs/promises';
import path from 'node:path';
import { type ArgumentsCamelCase, type CommandModule } from 'yargs';
import { container } from '../container.ts';
import { setServerOptions } from '../globals.ts';
import { Server } from '../Server.ts';
import { getBooleanEnvVar, TUNARR_ENV_VARS } from '../util/env.ts';
import { getTunarrVersion } from '../util/version.ts';
import { type ServerArgsType } from './RunServerCommand.ts';
import { type GlobalArgsType } from './types.ts';

export type GenerateOpenApiCommandArgs = ServerArgsType & {
  apiVersion: string;
};

export const GenerateOpenApiCommand: CommandModule<
  GlobalArgsType,
  GenerateOpenApiCommandArgs
> = {
  command: ['generate-openapi'],
  describe: 'Generates the OpenAPI JSON definition of the Tunarr API',
  builder: {
    port: {
      alias: 'p',
      type: 'number',
      desc: 'The port to run the Tunarr server on',
      default: 0,
    },
    printRoutes: {
      type: 'boolean',
      default: () =>
        getBooleanEnvVar(TUNARR_ENV_VARS.PRINT_ROUTES_ENV_VAR, false),
    },
    apiVersion: {
      type: 'string',
      default: 'latest',
    },
  },
  handler: async (args: ArgumentsCamelCase<GenerateOpenApiCommandArgs>) => {
    console.log('Generating OpenAPI doc for version ' + args.apiVersion);
    setServerOptions(args);
    const server = container.get<Server>(Server);
    await server.initAndRun();
    await server.close();
    const version = getTunarrVersion();
    const outputDir = path.resolve(process.cwd(), '..', 'docs', 'generated');
    const fileName = `tunarr-v${version}-openapi.json`;
    await fs.writeFile(
      path.join(outputDir, fileName),
      JSON.stringify(server.getOpenApiDocument()),
    );
    process.exit(0);
  },
};
