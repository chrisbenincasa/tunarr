ARG base_image=jasongdove/ersatztv-ffmpeg
ARG base_image_tag=7.0

# Setup a node + ffmpeg + nvidia base
FROM ${base_image}:${base_image_tag} AS ffmpeg-base
ENV NODE_MAJOR=22
ENV TUNARR_BIND_ADDR=0.0.0.0
# Expose Tunarr server default port
EXPOSE 8000
# Expose SSDP default port
EXPOSE 1900/udp 

# Update deps, Install Bun
# Install musl for native node bindings (sqlite)
RUN <<EOF
apt-get update --fix-missing && apt-get install -y ca-certificates curl gnupg unzip wget musl-dev
EOF
RUN ln -s /usr/lib/x86_64-linux-musl/libc.so /lib/libc.musl-x86_64.so.1
RUN <<EOF
curl -fsSL https://bun.sh/install | bash -s "bun-v1.2.0"
EOF
RUN ln -s ~/.bun/bin/bun /usr/bin/bun

# Install node - we still need this for some dev tools (for now)
RUN <<EOF 
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update && apt-get install nodejs -y
EOF

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -
RUN corepack enable
RUN ln -s /usr/local/bin/ffmpeg /usr/bin/ffmpeg
RUN ln -s /usr/local/bin/ffprobe /usr/bin/ffprobe
ENTRYPOINT [ "/tunarr/tunarr-linux-x64" ]
CMD [ "server" ]

# Add Tunarr sources
FROM ffmpeg-base AS sources
WORKDIR /tunarr
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY scripts ./scripts
COPY server/ ./server
COPY shared/ ./shared
COPY types ./types
COPY web ./web
COPY patches ./patches

# Dev container
FROM ffmpeg-base AS dev
EXPOSE 5173
WORKDIR /tunarr
COPY . .
RUN pnpm install --frozen-lockfile
ENTRYPOINT [ "pnpm" ]
CMD [ "turbo", "dev" ]

# Step for caching production deps
FROM sources AS prod-deps
ARG NODE_ENVIRONMENT
ENV NODE_ENV=${NODE_ENVIRONMENT:-production}
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

### Begin server build ###
FROM sources AS build-server
# Install deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
ARG is_edge_build
ARG tunarr_build
# Build common modules
RUN <<EOF
touch server/.env
echo TUNARR_BUILD=${tunarr_build} >> server/.env
echo TUNARR_EDGE_BUILD=${is_edge_build} >> server/.env
cat server/.env
EOF
# Build and bundle
RUN pnpm turbo --filter=@tunarr/server make-exec -- --target linux-x64 --no-include-version
### End server build ###

### Begin server web ###
FROM sources AS build-web
# Install deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Build common modules
RUN pnpm turbo --filter=@tunarr/web bundle

FROM sources AS build-full-stack
# Install deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Bundle web in a separate task
RUN NODE_OPTIONS=--max-old-space-size=32768 pnpm turbo bundle --filter=@tunarr/web
RUN NODE_OPTIONS=--max-old-space-size=32768 pnpm turbo make-exec -- --target linux-x64 --no-include-version

### Begin server run ###
FROM ffmpeg-base AS server
COPY --from=prod-deps /tunarr/node_modules /tunarr/node_modules
COPY --from=prod-deps /tunarr/server/node_modules /tunarr/server/node_modules
COPY --from=build-server /tunarr/types /tunarr/types
COPY --from=build-server /tunarr/shared /tunarr/shared
COPY --from=build-server /tunarr/server/package.json /tunarr/server/package.json
COPY --from=build-server /tunarr/server/dist /tunarr/server/dist
# Create a symlink to the executable in /tunarr. This simplifies things for the
# user, such as volume mapping their legacy DBs, while not interrupting the
# other assumptions that Tunarr makes about its working directory
RUN ln -s /tunarr/server/dist/bin/tunarr-linux-x64 /tunarr/tunarr-linux-x64
### Begin server run

### Full stack ###
FROM ffmpeg-base AS full-stack
# Duplicate the COPY statements from server build to ensure we don't bundle
# twice, needlessly
COPY --from=prod-deps /tunarr/node_modules /tunarr/node_modules
COPY --from=prod-deps /tunarr/server/node_modules /tunarr/server/node_modules
COPY --from=build-full-stack /tunarr/types /tunarr/types
COPY --from=build-full-stack /tunarr/shared /tunarr/shared
COPY --from=build-full-stack /tunarr/server/package.json /tunarr/server/package.json
COPY --from=build-full-stack /tunarr/server/dist /tunarr/server/dist
COPY --from=build-full-stack /tunarr/web/dist /tunarr/server/dist/web
# Create a symlink to the executable in /tunarr. This simplifies things for the
# user, such as volume mapping their legacy DBs, while not interrupting the
# other assumptions that Tunarr makes about its working directory
RUN ln -s /tunarr/server/dist/bin/tunarr-linux-x64 /tunarr/tunarr-linux-x64