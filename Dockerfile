ARG base_image=ghcr.io/ersatztv/ersatztv-ffmpeg
ARG base_image_tag=7.1.1

# Setup a node + ffmpeg + nvidia base
FROM ${base_image}:${base_image_tag} AS ffmpeg-base
ENV NODE_MAJOR=22
ENV TUNARR_BIND_ADDR=0.0.0.0
# Expose Tunarr server default port
EXPOSE 8000
# Expose SSDP default port
EXPOSE 1900/udp 

# Update deps
# Install musl for native node bindings (sqlite)
RUN <<EOF
rm /var/lib/dpkg/info/libc-bin.*
apt-get clean
apt-get update --fix-missing
apt-get install libc-bin
apt-get install -y ca-certificates curl gnupg unzip wget musl-dev
ln -s /usr/lib/x86_64-linux-musl/libc.so /lib/libc.musl-x86_64.so.1
EOF

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
# RUN wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -
RUN npm install -g corepack@latest
RUN corepack enable && corepack enable pnpm
RUN pnpm --version
RUN ln -s /usr/local/bin/ffmpeg /usr/bin/ffmpeg
RUN ln -s /usr/local/bin/ffprobe /usr/bin/ffprobe
RUN curl -sfS https://dotenvx.sh | sh
ENTRYPOINT [ "dotenvx", "run", "--", "/tunarr/tunarr" ]
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
COPY CHANGELOG.md CHANGELOG.md

# Dev container
FROM ffmpeg-base AS dev
EXPOSE 5173
WORKDIR /tunarr

COPY ./server server
COPY ./web web
COPY ./shared shared
COPY ./types types
COPY ./scripts scripts
COPY ./patches patches
COPY README.md README.md
COPY package.json package.json
COPY pnpm-lock.yaml pnpm-lock.yaml
COPY pnpm-workspace.yaml pnpm-workspace.yaml
COPY turbo.json turbo.json

RUN pnpm install --frozen-lockfile
RUN pnpm turbo clean
ENTRYPOINT [ "pnpm" ]
CMD [ "turbo", "dev" ]

# Step for caching production deps
FROM sources AS prod-deps
ARG NODE_ENVIRONMENT
ENV NODE_ENV=${NODE_ENVIRONMENT:-production}
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM sources AS build-full-stack
ARG exec_target=linux-x64
ARG is_edge_build
ARG tunarr_version
ARG tunarr_build
ARG exec_target=linux-x64
# Build common modules
RUN <<EOF
touch .env
echo TUNARR_VERSION="${tunarr_version}" >> .env
echo TUNARR_BUILD="${tunarr_build}" >> .env
echo TUNARR_EDGE_BUILD=${is_edge_build} >> .env
echo TUNARR_BUILD_BASE_TAG=${base_image_tag} >> .env
cat .env
cp .env server/.env
cp .env web/.env
EOF
# Install deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo clean
# Bundle web in a separate task
RUN NODE_OPTIONS=--max-old-space-size=32768 pnpm turbo bundle --filter=@tunarr/web
RUN echo "Building target: ${exec_target}"
RUN pnpm turbo make-bin -- --target ${exec_target} --no-include-version

### Full stack ###
FROM ffmpeg-base AS full-stack
WORKDIR /tunarr
ARG exec_target=linux-x64
COPY --from=build-full-stack /tunarr/.env /tunarr/.env
COPY --from=build-full-stack /tunarr/server/bin /tunarr/server/bin
# Create a symlink to the executable in /tunarr. This simplifies things for the
# user, such as volume mapping their legacy DBs, while not interrupting the
# other assumptions that Tunarr makes about its working directory
RUN mkdir /tunarr/bin
RUN ln -s /tunarr/server/bin/meilisearch-${exec_target} /tunarr/bin/meilisearch
RUN ln -s /tunarr/server/bin/tunarr-${exec_target} /tunarr/tunarr