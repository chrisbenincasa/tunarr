**Outdated direct dependency inventory — 16 September 2026**

Companion to the [audit](dependency-audit-2026-09-16.md). Source: `pnpm outdated -r --format json`, cross-checked against lockfile importers. Latest values come from the npm registry. This is an inventory, not an instruction to adopt every latest version. Workspace versions list all resolved direct versions found in the lockfile; workspace names describe the outdated command result. Packages absent from this list were not reported outdated, which does not establish compatibility or maintenance health.

| Package                              | Resolved direct versions | Registry latest      | Reported workspaces                |
| ------------------------------------ | ------------------------ | -------------------- | ---------------------------------- |
| `@commitlint/cli`                    | 19.3.0                   | 21.2.2               | tunarr                             |
| `@commitlint/config-conventional`    | 19.2.2                   | 21.2.2               | tunarr                             |
| `@commitlint/types`                  | 19.0.3                   | 21.2.0               | tunarr                             |
| `@dotenvx/dotenvx`                   | 1.45.1, 1.51.0           | 2.28.0               | server                             |
| `@emotion/styled`                    | 11.14.0                  | 11.14.1              | web                                |
| `@faker-js/faker`                    | 9.9.0                    | 10.6.0               | server                             |
| `@fastify/cors`                      | 10.1.0                   | 11.3.0               | server                             |
| `@fastify/multipart`                 | 9.2.1                    | 10.1.1               | server                             |
| `@fastify/swagger`                   | 9.5.1                    | 9.8.1                | server                             |
| `@hey-api/openapi-ts`                | 0.80.16                  | 0.99.0               | web                                |
| `@hookform/resolvers`                | 5.2.2                    | 5.9.1                | web                                |
| `@lingui/cli`                        | 5.9.0                    | 6.7.0                | web                                |
| `@lingui/core`                       | 5.9.0                    | 6.7.0                | web                                |
| `@lingui/format-po`                  | 5.9.0                    | 6.7.0                | web                                |
| `@lingui/react`                      | 5.9.0                    | 6.7.0                | web                                |
| `@lingui/swc-plugin`                 | 5.10.1                   | 6.7.0                | web                                |
| `@lingui/vite-plugin`                | 5.9.0                    | 6.7.0                | web                                |
| `@marcbachmann/cel-js`               | 7.6.1                    | 8.0.0                | server                             |
| `@microsoft/api-extractor`           | 7.43.0                   | 7.59.1               | types                              |
| `@mui/icons-material`                | 7.0.2                    | 9.4.0                | web                                |
| `@mui/material`                      | 7.0.2                    | 9.4.0                | web                                |
| `@mui/x-date-pickers`                | 8.4.0                    | 9.13.0               | web                                |
| `@octokit/types`                     | 13.10.0                  | 18.0.0               | server                             |
| `@release-it/bumper`                 | 7.0.5                    | 8.0.1                | tunarr                             |
| `@release-it/conventional-changelog` | 10.0.4                   | 12.0.2               | tunarr                             |
| `@rollup/plugin-swc`                 | 0.4.0                    | 0.4.1                | server, shared                     |
| `@scalar/fastify-api-reference`      | 1.38.1                   | 1.69.0               | server                             |
| `@semantic-release/changelog`        | 6.0.3                    | 7.0.0                | tunarr                             |
| `@tanstack/react-devtools`           | 0.9.13                   | 0.10.12              | web                                |
| `@tanstack/react-form`               | 1.29.0                   | 1.33.5               | web                                |
| `@tanstack/react-form-devtools`      | 0.2.21                   | 0.2.34               | web                                |
| `@tanstack/react-query`              | 5.20.5                   | 5.103.1              | web                                |
| `@tanstack/react-query-devtools`     | 5.18.1                   | 5.103.1              | web                                |
| `@tanstack/react-router`             | 1.133.13                 | 1.170.38             | web                                |
| `@tanstack/react-router-devtools`    | 1.166.13                 | 1.167.2              | web                                |
| `@tanstack/react-table`              | 8.19.3                   | 9.2.4                | web                                |
| `@tanstack/router-cli`               | 1.35.4                   | 1.167.38             | web                                |
| `@tanstack/router-vite-plugin`       | 1.133.13                 | 1.167.40             | web                                |
| `@tanstack/zod-adapter`              | 1.133.13                 | 1.167.0              | web                                |
| `@testing-library/jest-dom`          | 6.9.1                    | 7.0.1                | web                                |
| `@testing-library/react`             | 16.3.2                   | 16.3.3               | web                                |
| `@testing-library/user-event`        | 14.6.1                   | 14.6.7               | web                                |
| `@types/archiver`                    | 6.0.3                    | 8.0.0                | server                             |
| `@types/better-sqlite3`              | 7.6.13                   | 9.6.0                | server                             |
| `@types/lodash-es`                   | 4.17.9                   | 4.17.12              | server, shared, web                |
| `@types/node`                        | 22.10.7                  | 22.20.3              | tunarr, server, shared             |
| `@types/react`                       | 18.2.15                  | 19.3.0               | web                                |
| `@types/react-dom`                   | 18.2.7                   | 19.3.0               | web                                |
| `@types/react-window`                | 1.8.8                    | 2.0.0                | web                                |
| `@types/semver`                      | 7.7.1                    | 7.8.0                | tunarr                             |
| `@types/uuid`                        | 9.0.6, 9.0.8             | 11.0.0               | server                             |
| `@types/yargs`                       | 17.0.33                  | 17.0.35              | server                             |
| `@typescript/native-preview`         | 7.0.0-dev.20260421.2     | 7.0.0-dev.20260707.2 | server, shared, types, web         |
| `@vitejs/plugin-react-swc`           | 4.2.3                    | 4.3.3                | web                                |
| `@vitest/coverage-v8`                | 4.1.5                    | 5.0.1                | tunarr, server, shared             |
| `@yao-pkg/pkg`                       | 6.9.0                    | 6.22.0               | server                             |
| `archiver`                           | 7.0.1                    | 8.0.0                | server                             |
| `axios`                              | 1.12.2                   | 1.20.0               | server, web                        |
| `baseline-browser-mapping`           | 2.10.22                  | 2.11.24              | web                                |
| `better-sqlite3`                     | 11.8.1                   | 13.0.3               | server                             |
| `bowser`                             | 2.11.0                   | 2.14.1               | web                                |
| `chalk`                              | 5.6.2                    | 6.0.0                | server                             |
| `chevrotain`                         | 11.0.3                   | 13.2.0               | shared                             |
| `color`                              | 5.0.0                    | 5.0.3                | web                                |
| `colorjs.io`                         | 0.5.2                    | 0.7.1                | web                                |
| `cron-parser`                        | 4.9.0                    | 5.10.1               | server                             |
| `cross-env`                          | 7.0.3                    | 10.1.0               | server                             |
| `dayjs`                              | 1.11.20                  | 1.11.23              | server, shared, web                |
| `del-cli`                            | 3.0.1                    | 7.0.0                | server                             |
| `dotenv-cli`                         | 7.4.4                    | 11.0.0               | server                             |
| `drizzle-kit`                        | 0.30.6                   | 0.31.10              | server                             |
| `drizzle-orm`                        | 0.39.3                   | 0.45.2               | server                             |
| `esbuild`                            | 0.21.5                   | 0.28.2               | tunarr, server                     |
| `fast-check`                         | 4.2.0                    | 4.10.1               | server                             |
| `fast-xml-parser`                    | 4.5.3                    | 5.11.1               | server                             |
| `fastify`                            | 5.6.1                    | 5.12.5               | server                             |
| `fastify-graceful-shutdown`          | 4.0.1                    | 5.0.0                | server                             |
| `fastify-plugin`                     | 5.0.1                    | 6.0.0                | server                             |
| `fastify-print-routes`               | 3.2.0                    | 5.0.1                | server                             |
| `fastify-type-provider-zod`          | 5.0.3                    | 7.0.0                | server                             |
| `file-type`                          | 19.6.0                   | 22.1.0               | server                             |
| `find-process`                       | 2.0.0                    | 2.1.1                | server                             |
| `hls.js`                             | 1.6.15                   | 1.7.3                | web                                |
| `husky`                              | 9.0.11                   | 9.1.7                | tunarr                             |
| `immer`                              | 10.0.3                   | 11.1.18              | web                                |
| `inversify`                          | 8.1.0                    | 8.2.3                | server                             |
| `jsdom`                              | 28.1.0                   | 30.1.0               | web                                |
| `jsonpath-plus`                      | 10.3.0                   | 10.4.0               | server                             |
| `knip`                               | 6.7.0                    | 6.36.0               | tunarr                             |
| `kysely`                             | 0.27.6                   | 0.29.6               | server                             |
| `kysely-ctl`                         | 0.9.0                    | 0.21.0               | server                             |
| `lint-staged`                        | 15.2.2                   | 17.5.1               | tunarr                             |
| `lodash-es`                          | 4.17.21                  | 4.18.1               | server, shared, web                |
| `make-vfs`                           | 1.0.15                   | 1.0.16               | web                                |
| `meilisearch`                        | 0.50.0                   | 0.62.0               | server                             |
| `memfs`                              | 4.51.0                   | 4.78.0               | server                             |
| `music-metadata`                     | 11.10.5                  | 11.15.0              | server                             |
| `node-abi`                           | 3.78.0                   | 4.35.0               | server                             |
| `nodemon`                            | 3.1.0                    | 3.1.14               | web                                |
| `notistack`                          | 3.0.1                    | 3.0.2                | web                                |
| `openapi-zod-client`                 | 1.14.0                   | 1.18.3               | web                                |
| `p-queue`                            | 8.1.1                    | 9.3.3                | server                             |
| `pino`                               | 9.14.0                   | 10.3.1               | server                             |
| `pino-roll`                          | 1.3.0                    | 4.0.0                | server                             |
| `prettier`                           | 3.5.1, 3.6.2             | 3.9.7                | server                             |
| `query-string`                       | 9.1.1                    | 9.5.1                | web                                |
| `react`                              | 18.2.0                   | 19.3.0               | web                                |
| `react-dom`                          | 18.2.0                   | 19.3.0               | web                                |
| `react-error-boundary`               | 6.0.0                    | 6.1.5                | web                                |
| `react-hook-form`                    | 7.68.0                   | 7.88.0               | web                                |
| `react-virtualized-auto-sizer`       | 1.0.26                   | 2.0.3                | web                                |
| `react-window`                       | 1.8.9                    | 2.3.1                | web                                |
| `release-it`                         | 19.2.2                   | 21.0.3               | tunarr                             |
| `rimraf`                             | 5.0.10, 5.0.5            | 6.1.3                | shared, types                      |
| `semantic-release`                   | 25.0.2                   | 25.0.9               | tunarr                             |
| `semver`                             | 7.7.3                    | 7.8.5                | tunarr                             |
| `sonic-boom`                         | 4.2.0                    | 5.0.1                | server                             |
| `tar`                                | 7.4.3                    | 7.5.22               | server                             |
| `thread-stream`                      | 3.1.0                    | 4.2.0                | server                             |
| `tmp`                                | 0.2.5                    | 0.2.7                | server                             |
| `ts-essentials`                      | 10.1.1, 9.4.2            | 10.2.1               | shared, web                        |
| `ts-pattern`                         | 5.4.0, 5.8.0             | 5.9.0                | server                             |
| `tslib`                              | 2.6.2, 2.8.1             | 2.8.1                | shared                             |
| `tsup`                               | 8.0.2                    | 8.5.1                | shared, types                      |
| `tsx`                                | 4.20.6                   | 4.23.13              | tunarr, server, shared             |
| `turbo`                              | 2.5.3                    | 2.10.13              | tunarr                             |
| `typed-openapi`                      | 0.10.1                   | 4.1.0                | types                              |
| `typescript`                         | 5.9.3                    | 7.0.2                | tunarr, server, shared, types, web |
| `usehooks-ts`                        | 2.14.0                   | 3.1.1                | web                                |
| `uuid`                               | 9.0.1                    | 14.0.2               | server, web                        |
| `vite`                               | 7.1.10                   | 8.3.0                | web                                |
| `vite-plugin-svgr`                   | 4.5.0                    | 5.2.0                | web                                |
| `vitest`                             | 4.1.5                    | 5.0.1                | tunarr, server, shared, web        |
| `yargs`                              | 17.7.2                   | 18.1.0               | server                             |
| `zod`                                | 4.3.6                    | 4.6.5                | server, shared, types, web         |
| `zustand`                            | 4.4.6                    | 5.0.15               | web                                |
