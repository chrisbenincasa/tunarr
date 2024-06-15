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

config.getMetadataCacheAdapter().clear();
config.set('logger', CLIHelper.dump.bind(null));
config.set('debug', true);
const discovery = new MetadataDiscovery(
  MetadataStorage.init(),
  config.getDriver().getPlatform(),
  config,
);
await discovery.discover(true);

const combined = config.get('metadataCache').combined;
CLIHelper.dump(
  colors.green(
    `${
      combined ? 'Combined ' : ''
    }TS metadata cache was successfully generated${
      combined ? ' to ' + combined : ''
    }`,
  ),
);
