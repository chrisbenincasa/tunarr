# Setup a node + ffmpeg + nvidia base
FROM jrottenberg/ffmpeg:4.4.4-nvidia2204 AS ffmpeg-base
ENV NODE_MAJOR=20

# Install musl for native node bindings (sqlite)
RUN apt-get install -y musl-dev
RUN ln -s /usr/lib/x86_64-linux-musl/libc.so /lib/libc.musl-x86_64.so.1

# Install node
RUN <<EOF 
apt-get update && apt-get install -y ca-certificates curl gnupg
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update && apt-get install nodejs -y
EOF

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

EXPOSE 8000
RUN ln -s /usr/local/bin/ffmpeg /usr/bin/ffmpeg
ENTRYPOINT [ "node" ]

# Add Tunarr sources
FROM ffmpeg-base as sources
WORKDIR /tunarr
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/ ./server
COPY shared/ ./shared
COPY types ./types
COPY web ./web

FROM sources AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

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
RUN pnpm run --filter=web bundle

### Begin server run ###
FROM ffmpeg-base AS server
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
