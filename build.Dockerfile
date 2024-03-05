FROM node:20-alpine3.19 AS base

# Update
RUN apk add --no-cache libc6-compat
RUN apk update

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base as sources
WORKDIR /tunarr
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/ ./server
COPY shared/ ./shared
COPY types ./types
COPY web ./web

FROM sources AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# FROM sources AS build-libs
# RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# RUN pnpm run --filter=types --filter shared build

### Begin server build ###
FROM sources AS build-server
# Install deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Build common modules
RUN pnpm run --filter=types --filter=shared build
# Runs tsc --noEmit on the server to ensure the code builds
RUN pnpm run --filter=server typecheck
# Build ORM metadata cache using source files
RUN cd server && pnpm mikro-orm-esm cache:generate --combined --ts
# Replace the non-cached metadata config with the cache
RUN mv server/mikro-orm.prod.config.ts server/mikro-orm.config.ts 
# Build and bundle the server
RUN pnpm run --filter=server bundle
### End server build ###

### Begin server web ###
FROM sources AS build-web
# Install deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Build common modules
RUN pnpm run --filter=types --filter=shared build
RUN pnpm run --filter=web build

### Experimental: Build a SEA
FROM build-server AS build-exec
COPY --from=build-server /tunarr/server/node_modules /tunarr/server/node_modules
COPY --from=build-server /tunarr/server/build /tunarr/server/build
RUN pnpm run --filter=server make-exec
###

### Begin server run ###
FROM base AS server
COPY --from=prod-deps /tunarr/node_modules /tunarr/node_modules
COPY --from=prod-deps /tunarr/server/node_modules /tunarr/server/node_modules
COPY --from=build-server /tunarr/types /tunarr/types
COPY --from=build-server /tunarr/shared /tunarr/shared
COPY --from=build-server /tunarr/server/package.json /tunarr/server/package.json
COPY --from=build-server /tunarr/server/build /tunarr/server/build
ENV TUNARR_BIND_ADDR=0.0.0.0
EXPOSE 8000
CMD [ "/tunarr/server/build/bundle.js" ]
### Begin server run

### Full stack ###
FROM server AS full-stack
COPY --from=build-web /tunarr/web/dist /tunarr/server/build/web
