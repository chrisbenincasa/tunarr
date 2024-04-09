FROM node:20-alpine3.19 AS base

# Update
RUN apk add --no-cache libc6-compat
RUN apk update

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base as sources
WORKDIR /tunarr
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY server/ ./server
COPY shared/ ./shared
COPY types ./types
COPY web ./web
COPY patches ./patches

FROM sources AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

### Begin server build ###
FROM sources AS build-server
# Install deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Build and bundle
RUN pnpm turbo --filter=@tunarr/server bundle
### End server build ###

### Begin server web ###
FROM sources AS build-web
# Install deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Build and bundle
RUN pnpm turbo --filter=@tunarr/web bundle

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
