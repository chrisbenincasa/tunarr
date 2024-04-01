import { Plugin } from 'esbuild';
import path from 'node:path';

// Replaces the development mikro-orm.config.ts with
// mikro-orm.prod.config.ts when bundling.
export const mikroOrmProdPlugin = (): Plugin => {
  return {
    name: 'mikro-orm-prod-config',
    setup(build) {
      build.onResolve(
        { filter: /.*mikro-orm\.config\.js$/g, namespace: 'file' },
        (args) => {
          return {
            path: path.resolve(
              args.resolveDir,
              args.path
                .replace('mikro-orm.config', 'mikro-orm.prod.config')
                .replace('.js', '.ts'),
            ),
          };
        },
      );
    },
  };
};
