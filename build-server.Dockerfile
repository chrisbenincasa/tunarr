FROM node:18-alpine3.19 AS base

# Update
RUN apk add --no-cache libc6-compat
RUN apk update

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base as sources
WORKDIR /tunarr
COPY package.json package-lock.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/ ./server
COPY shared/ ./shared
COPY types ./types

FROM sources AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM sources AS build-server
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# RUN pnpm run --filter=server build
RUN pnpm run --filter=server bundle

FROM build-server AS build-exec
COPY --from=build-server /tunarr/server/node_modules /tunarr/server/node_modules
COPY --from=build-server /tunarr/server/build /tunarr/server/build
RUN pnpm run --filter=server make-exec

FROM base AS server
COPY --from=prod-deps /tunarr/node_modules /tunarr/node_modules
COPY --from=prod-deps /tunarr/server/node_modules /tunarr/server/node_modules
#COPY --from=build-server /tunarr/server/resources /tunarr/server/resources
COPY --from=build-server /tunarr/server/build /tunarr/server/build
