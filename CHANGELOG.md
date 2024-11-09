# Changelog

## [0.15.9](https://github.com/chrisbenincasa/tunarr/compare/v0.15.8...v0.15.9) (2024-11-09)


### Bug Fixes

* account for windows taskkill exits in FfmpegProcess ([75e2a91](https://github.com/chrisbenincasa/tunarr/commit/75e2a910bbef5afcd2d01fe013a24860eda7ad73))


### UI Changes

* add discord icon to top nav bar ([ffcc4b2](https://github.com/chrisbenincasa/tunarr/commit/ffcc4b21113dd872a29241e5f270e28db4094ba8)), closes [#947](https://github.com/chrisbenincasa/tunarr/issues/947)

## [0.15.8](https://github.com/chrisbenincasa/tunarr/compare/v0.15.7...v0.15.8) (2024-11-09)


### Bug Fixes

* re-enable custom shows in time slot editor ([deae3de](https://github.com/chrisbenincasa/tunarr/commit/deae3de6fda593e8c489600b9606b3e2b5af874a))

## [0.15.7](https://github.com/chrisbenincasa/tunarr/compare/v0.15.6...v0.15.7) (2024-11-08)


### Bug Fixes

* remove errant quote in windows process kill cmd ([88e640b](https://github.com/chrisbenincasa/tunarr/commit/88e640ba28edb9774e3d8fb8b50b2a0334a9e814))
* resolve Jellyfin items when underlying file changes ([#933](https://github.com/chrisbenincasa/tunarr/issues/933)) ([d8b8e09](https://github.com/chrisbenincasa/tunarr/commit/d8b8e09d00d35b9639d477c669aaa1bba795aa6a))
* use Windows-specific task kill command as .kill() doesnt seem to work ([0f5b437](https://github.com/chrisbenincasa/tunarr/commit/0f5b43797bc60b4844573123b182527fbc8c1231))


### Performance Improvements

* do not re-render entire time slot page when slot changes ([#949](https://github.com/chrisbenincasa/tunarr/issues/949)) ([db78856](https://github.com/chrisbenincasa/tunarr/commit/db7885652f63a0b2607fc488969e9f573a782b9e))


### UI Changes

* add clear all button to timeslots page ([0bae6e6](https://github.com/chrisbenincasa/tunarr/commit/0bae6e63c561cadae2c47b81fdf7ec278980d3ed))
* flush load items ([#948](https://github.com/chrisbenincasa/tunarr/issues/948)) ([c86dd6a](https://github.com/chrisbenincasa/tunarr/commit/c86dd6a9dc3141e5d015e24e88da13848fb129e4))
* simplify time slot page title ([d59df21](https://github.com/chrisbenincasa/tunarr/commit/d59df21fb435a8fa34effe1c140cb3e2bad040fb))

## [0.15.6](https://github.com/chrisbenincasa/tunarr/compare/v0.15.5...v0.15.6) (2024-11-07)


### Bug Fixes

* improve image caching logic ([859f679](https://github.com/chrisbenincasa/tunarr/commit/859f679b9f457bf07e0c8c43f4b3077a1179e192))
* never clear, and always update, program relations on upsert ([86c5330](https://github.com/chrisbenincasa/tunarr/commit/86c533027addacd6e2fddc43dbf1a23a6541a2af))

## [0.15.5](https://github.com/chrisbenincasa/tunarr/compare/v0.15.4...v0.15.5) (2024-11-05)


### Bug Fixes

* do not remove scheduling configurations when adding new programs ([#936](https://github.com/chrisbenincasa/tunarr/issues/936)) ([d18e99d](https://github.com/chrisbenincasa/tunarr/commit/d18e99d5769762388b859c4fd22ae7044f7b74cc)), closes [#934](https://github.com/chrisbenincasa/tunarr/issues/934)
* fix deleting filler shows using new db code ([95bf2b3](https://github.com/chrisbenincasa/tunarr/commit/95bf2b380adcb5ff3e0ade7e04c7a10ca0cdbbb0))
* fix passing arguments to standalone script files ([#939](https://github.com/chrisbenincasa/tunarr/issues/939)) ([82b2a2c](https://github.com/chrisbenincasa/tunarr/commit/82b2a2c363bf01c77c9f7325b62feb70f1d64650))
* reference correct table in channel_filler_show filler_show_uuid foreign key ([a3539ed](https://github.com/chrisbenincasa/tunarr/commit/a3539ed540601bb6669b27bb34c7b227ab7c7058)), closes [#931](https://github.com/chrisbenincasa/tunarr/issues/931)
* uploads can just be renamed from saved temp path ([af14be1](https://github.com/chrisbenincasa/tunarr/commit/af14be130d4e50d2a4b8aa82bc4fb35b7bdc2598)), closes [#932](https://github.com/chrisbenincasa/tunarr/issues/932)

## [0.15.4](https://github.com/chrisbenincasa/tunarr/compare/v0.15.3...v0.15.4) (2024-11-02)


### Bug Fixes

* do not attempt to upgrade plex rating key for jellyfin items ([a406bde](https://github.com/chrisbenincasa/tunarr/commit/a406bde5002b4a41ed3b1b27d5c6b433ad248ac9))
* fix for updateProgramPlexRatingKey return query ([40c73c2](https://github.com/chrisbenincasa/tunarr/commit/40c73c2fff14fcdd9987b20e3e3f16cee7394af1))
* fix the build ([6eab3fb](https://github.com/chrisbenincasa/tunarr/commit/6eab3fb0d751c2c320d6ce3a4ca1336afac1eae8))

## [0.15.3](https://github.com/chrisbenincasa/tunarr/compare/v0.15.2...v0.15.3) (2024-11-02)


### Bug Fixes

* fix updating channels ([01fb70d](https://github.com/chrisbenincasa/tunarr/commit/01fb70df392d8955c9462e90985a52836d01809a))
* run enabled backup jobs once immediately when enabled ([#926](https://github.com/chrisbenincasa/tunarr/issues/926)) ([2ffa2cc](https://github.com/chrisbenincasa/tunarr/commit/2ffa2ccbd5ea9dba7ec1554292eed1ff7756aa40)), closes [#923](https://github.com/chrisbenincasa/tunarr/issues/923)

## [0.15.2](https://github.com/chrisbenincasa/tunarr/compare/v0.15.1...v0.15.2) (2024-11-01)


### Bug Fixes

* fix conditional index conditions in new migrations ([cb939ca](https://github.com/chrisbenincasa/tunarr/commit/cb939cac491e014b0ec1a98a1c47e803ef5ddd48))

## [0.15.1](https://github.com/chrisbenincasa/tunarr/compare/v0.15.0...v0.15.1) (2024-10-31)


### Bug Fixes

* program_grouping_external_id.external_source_id is nullable ([e31f5c3](https://github.com/chrisbenincasa/tunarr/commit/e31f5c308b481ee143fb4c36e35d60385c761202))

## [0.15.0](https://github.com/chrisbenincasa/tunarr/compare/v0.14.2...v0.15.0) (2024-10-31)


### Bug Fixes

* can't use chain in shared lib either because it gets bundled into server ([59c2ead](https://github.com/chrisbenincasa/tunarr/commit/59c2ead7aef276de198e8ab88cd5709d5d64e121))
* fix "specials" creating wrong XMLTV ([ce6b3d9](https://github.com/chrisbenincasa/tunarr/commit/ce6b3d9ccbe361f04952971661bc8e97894dc87a)), closes [#666](https://github.com/chrisbenincasa/tunarr/issues/666)
* handle undefined durations from Plex ([#912](https://github.com/chrisbenincasa/tunarr/issues/912)) ([ea163ee](https://github.com/chrisbenincasa/tunarr/commit/ea163ee32f6cb622f4ab8b28fdc2aecfdd3cfb16))
* show edge commit in tunarr version for edge builds ([c3f04cd](https://github.com/chrisbenincasa/tunarr/commit/c3f04cd50c64c29d2f1717634c255f09d3eebc0a))


### Miscellaneous Chores

* release 0.15.0 ([1555d38](https://github.com/chrisbenincasa/tunarr/commit/1555d389e586ce07551434e1dba081ad967755e3))

## [0.14.2](https://github.com/chrisbenincasa/tunarr/compare/v0.14.1...v0.14.2) (2024-10-24)


### Bug Fixes

* fix playing Video-type Jellyfin streams ([#902](https://github.com/chrisbenincasa/tunarr/issues/902)) ([68670f8](https://github.com/chrisbenincasa/tunarr/commit/68670f814adf77192f309278628fc1333dc0152c))
* fix plex auto-channel mapping update ([70ecd00](https://github.com/chrisbenincasa/tunarr/commit/70ecd0035bc322f9b700dc8f3f7076a0cac533a7))
* fix VAAPI rendering ([#884](https://github.com/chrisbenincasa/tunarr/issues/884)) ([e8a5656](https://github.com/chrisbenincasa/tunarr/commit/e8a565641a9a7fbfc18e3eafab03bddda1d3c64d))
* handle more Jellyfin item types in program selector ([#883](https://github.com/chrisbenincasa/tunarr/issues/883)) ([1f2d963](https://github.com/chrisbenincasa/tunarr/commit/1f2d9634686a6e9c4ee3902a7933534eb6aad168))
* persist channel table page state across nav ([#894](https://github.com/chrisbenincasa/tunarr/issues/894)) ([3e5e42a](https://github.com/chrisbenincasa/tunarr/commit/3e5e42a7df75f501db4aaad44c7fbb76f18d0565)), closes [#888](https://github.com/chrisbenincasa/tunarr/issues/888)
* properly clear m3u cache when channels change ([#895](https://github.com/chrisbenincasa/tunarr/issues/895)) ([5bdc92b](https://github.com/chrisbenincasa/tunarr/commit/5bdc92b75ee6458acade18e74c102a6b4593cc91))

## [0.14.1](https://github.com/chrisbenincasa/tunarr/compare/v0.14.0...v0.14.1) (2024-10-21)


### Bug Fixes

* fix ffmpeg path normalization for Windows ([5adf769](https://github.com/chrisbenincasa/tunarr/commit/5adf76907b4b40d3435b8962921097ffce734c4c))
* increase exp backoff factor for HLS sessions; theoretical max wait of ~2mins ([d272d21](https://github.com/chrisbenincasa/tunarr/commit/d272d21a9f84ff0dda66067444edc602004824b6))
* remove uuid format requirement from some Jellyfin types ([1ced59f](https://github.com/chrisbenincasa/tunarr/commit/1ced59f7602bb8d99f8fb44584cebbfcc34d159b))

## [0.14.0](https://github.com/chrisbenincasa/tunarr/compare/v0.13.2...v0.14.0) (2024-10-21)


### Features

* introduce health checks and system status page ([#885](https://github.com/chrisbenincasa/tunarr/issues/885)) ([03f57e0](https://github.com/chrisbenincasa/tunarr/commit/03f57e0ed5bf7e402c2f9d77ce88e48cee96780f))


### Bug Fixes

* fix channel deletes when channel is associated with fillers ([#889](https://github.com/chrisbenincasa/tunarr/issues/889)) ([83126c8](https://github.com/chrisbenincasa/tunarr/commit/83126c865929d831f094cdd5538d7d89f3774c89))
* mitigate RCE vulneratbility ([#892](https://github.com/chrisbenincasa/tunarr/issues/892)) ([4570b08](https://github.com/chrisbenincasa/tunarr/commit/4570b08bd35083b8dbaeecfed7e6f9b1e855d7c0))

## [0.13.2](https://github.com/chrisbenincasa/tunarr/compare/v0.13.1...v0.13.2) (2024-10-16)


### Bug Fixes

* correct conditional for adding reconnect settings ([8c94af4](https://github.com/chrisbenincasa/tunarr/commit/8c94af4577cc6613b4ff82b126948ce3793d3fcb))
* differentiate file/http stream source inputs ([#873](https://github.com/chrisbenincasa/tunarr/issues/873)) ([fc836b8](https://github.com/chrisbenincasa/tunarr/commit/fc836b82ba198ae86c5b7764deb709e7834624f0))
* mark addedAt field as optional in all Plex types ([#874](https://github.com/chrisbenincasa/tunarr/issues/874)) ([f68e89f](https://github.com/chrisbenincasa/tunarr/commit/f68e89f283d1d52fe1bf1a4e0717cc3ae878abd3)), closes [#863](https://github.com/chrisbenincasa/tunarr/issues/863)
* properly calculate filler show content counts ([#881](https://github.com/chrisbenincasa/tunarr/issues/881)) ([11abbc1](https://github.com/chrisbenincasa/tunarr/commit/11abbc1dcd71011b307951c540c5e3a33c408e44)), closes [#872](https://github.com/chrisbenincasa/tunarr/issues/872)
* use window location for base URL in m3u clipboard copy when backend url is empty ([#880](https://github.com/chrisbenincasa/tunarr/issues/880)) ([a99d3ca](https://github.com/chrisbenincasa/tunarr/commit/a99d3ca3cd897f82245e86e93bb995fb0816fb32)), closes [#878](https://github.com/chrisbenincasa/tunarr/issues/878)

## [0.13.1](https://github.com/chrisbenincasa/tunarr/compare/v0.13.0...v0.13.1) (2024-10-15)


### Bug Fixes

* accept array type in Jellyfin API items extraFields query param ([f511edd](https://github.com/chrisbenincasa/tunarr/commit/f511edd55f594208240f4adee99ff80b23a32d28))
* accept array type in Jellyfin items API endpoint ([edbef2b](https://github.com/chrisbenincasa/tunarr/commit/edbef2b074377950c275430a967c7be2586b7d53))
* correctly handle error streams in default HLS mode ([#867](https://github.com/chrisbenincasa/tunarr/issues/867)) ([4f3ae86](https://github.com/chrisbenincasa/tunarr/commit/4f3ae86934a994d146b1030ef0987c56aa3c94b3))
* handle ffmpeg "unknown" version on welcome screen ([a134cab](https://github.com/chrisbenincasa/tunarr/commit/a134cab237f177143ac89174dca35fca7ca93e23))

## [0.13.0](https://github.com/chrisbenincasa/tunarr/compare/v0.12.4...v0.13.0) (2024-10-14)


### ⚠ BREAKING CHANGES

* use new, segmeneted channel IDs in xmltv as wordaround for Plex guide bug ([#855](https://github.com/chrisbenincasa/tunarr/issues/855))

### Features

* improved grid view with alphanumeric quick filter ([#832](https://github.com/chrisbenincasa/tunarr/issues/832)) ([1e50a83](https://github.com/chrisbenincasa/tunarr/commit/1e50a837cd995e9b8c52751cfe3e8783ccdba8fc))


### Bug Fixes

* convert 10-bit inputs to 8-bit for non-supported NVDA+format combos ([#765](https://github.com/chrisbenincasa/tunarr/issues/765)) ([d02b834](https://github.com/chrisbenincasa/tunarr/commit/d02b834719f1ee8e85fc9cf11c29d9198160429f))
* fix on-demand channel pause times when watching mpeg-ts streams ([2bececf](https://github.com/chrisbenincasa/tunarr/commit/2bececf75226411aa7ce5baa31411ffb301cbcc5))
* reimplement BackfillProgramGroupings fixer ([#864](https://github.com/chrisbenincasa/tunarr/issues/864)) ([0dd8dbc](https://github.com/chrisbenincasa/tunarr/commit/0dd8dbc6ee702375629d0c13aff3f87f66925e0a))
* temporarily raise the body limit for channel lineup updates ([b062dbe](https://github.com/chrisbenincasa/tunarr/commit/b062dbe11c57f85c3bc3763f37c0d895cfe061f6))
* use new, segmeneted channel IDs in xmltv as wordaround for Plex guide bug ([#855](https://github.com/chrisbenincasa/tunarr/issues/855)) ([9e10d78](https://github.com/chrisbenincasa/tunarr/commit/9e10d78d3cea202239cdebd231476c69bf635fc7))
* use proper m3u links in frontend ([#854](https://github.com/chrisbenincasa/tunarr/issues/854)) ([accb0d7](https://github.com/chrisbenincasa/tunarr/commit/accb0d74f7fdbe61e74e0aca2645ce100fc5b0c2))
* use req.host instead of req.hostname because it includes port ([3acca8e](https://github.com/chrisbenincasa/tunarr/commit/3acca8ee3a20d79c52b9b4a3a489dbc99644ef86)), closes [#861](https://github.com/chrisbenincasa/tunarr/issues/861)
* wait on other transactions just in case ([#866](https://github.com/chrisbenincasa/tunarr/issues/866)) ([c5d82a5](https://github.com/chrisbenincasa/tunarr/commit/c5d82a52fdf18df5e396aaba44d3f29832d57c55))

## [0.12.4](https://github.com/chrisbenincasa/tunarr/compare/v0.12.3...v0.12.4) (2024-10-09)


### Bug Fixes

* allow setting ffprobe path instead of deriving it ([#842](https://github.com/chrisbenincasa/tunarr/issues/842)) ([5771238](https://github.com/chrisbenincasa/tunarr/commit/577123872fd8d0d490b3762b903c7347e0689e6d))
* fix web video player ([5ff85f5](https://github.com/chrisbenincasa/tunarr/commit/5ff85f5dbfb639f35f45d748c12c33d86296401e))
* mark 1900/udp as exposed in Dockerfile for UDP server (HDHR auto-discovery) ([4638c70](https://github.com/chrisbenincasa/tunarr/commit/4638c70c5ab1dc04d0367490f1c5754d0369411d))
* remove eventual consistency for program_grouping upserts ([#843](https://github.com/chrisbenincasa/tunarr/issues/843)) ([d83113b](https://github.com/chrisbenincasa/tunarr/commit/d83113bbaa5a35396a265c98f0399521cf70fb3a)), closes [#825](https://github.com/chrisbenincasa/tunarr/issues/825)

## [0.12.3](https://github.com/chrisbenincasa/tunarr/compare/v0.12.2...v0.12.3) (2024-10-02)


### Bug Fixes

* always output yuv420p pixel format (for now) ([4548a3a](https://github.com/chrisbenincasa/tunarr/commit/4548a3adbb8d64109cb7c35010aa664ef47b2b93))
* external watermark loading fixes ([e324bac](https://github.com/chrisbenincasa/tunarr/commit/e324bac78d005a108a8386b60d46e490c92a6c05))
* handle Windows ffreport paths ([70f1f9b](https://github.com/chrisbenincasa/tunarr/commit/70f1f9ba394bf70d8e552811bae656ce443c23e7))
* properly construct program set before saving slot schedules ([ac3f84a](https://github.com/chrisbenincasa/tunarr/commit/ac3f84a11ad38b46374760ed2af22e9930d85b20))
* remove duplicates before running block shuffler ([9816749](https://github.com/chrisbenincasa/tunarr/commit/98167497be8faaffcadaf002ad764153dcb59ea0))
* try a different file path pattern for FFREPORT on Windows ([4675ec1](https://github.com/chrisbenincasa/tunarr/commit/4675ec1aa709cecbdc8370bd255ccd52193e0799))

## [0.12.2](https://github.com/chrisbenincasa/tunarr/compare/v0.12.1...v0.12.2) (2024-09-30)


### Bug Fixes

* improvements to session error state handling / cleanup ([550846e](https://github.com/chrisbenincasa/tunarr/commit/550846e9393fb49f9353c91811b72e12bf1bdbaf))
* include Client authorization value in Jellyfin auth header ([803faf8](https://github.com/chrisbenincasa/tunarr/commit/803faf8f39f87aa88a01f4b14236dc389a436275))
* mark plex video frame rate field as optional ([9307a18](https://github.com/chrisbenincasa/tunarr/commit/9307a1846be8f231f0ca187d72ef4023f49f2043)), closes [#819](https://github.com/chrisbenincasa/tunarr/issues/819)

## [0.12.1](https://github.com/chrisbenincasa/tunarr/compare/v0.12.0...v0.12.1) (2024-09-30)


### Bug Fixes

* bail on HLS stream wait if an error occurred on startup ([0a611c3](https://github.com/chrisbenincasa/tunarr/commit/0a611c30d4aab03f6cd276f59bfc77681cfa68c8))
* **server:** properly close event channels on server shutdown ([b7b2be6](https://github.com/chrisbenincasa/tunarr/commit/b7b2be6616d6745bd0591a6979740ec70290b8cb))
* **server:** use existing mappings in BackfillProgramGroupings fixer ([b7b2be6](https://github.com/chrisbenincasa/tunarr/commit/b7b2be6616d6745bd0591a6979740ec70290b8cb))
* treat video stream indexes as absolute ([d7f65ca](https://github.com/chrisbenincasa/tunarr/commit/d7f65ca78fa9c6fde83f4c63d09e91e89a9446fc))
* **web:** ability to perfectly loop block shuffled shows + other block shuffle fixes ([b7b2be6](https://github.com/chrisbenincasa/tunarr/commit/b7b2be6616d6745bd0591a6979740ec70290b8cb))

## [0.12.0](https://github.com/chrisbenincasa/tunarr/compare/v0.11.0...v0.12.0) (2024-09-27)


### Features

* improved program tools around balancing / block scheduling ([#802](https://github.com/chrisbenincasa/tunarr/issues/802)) ([bd65de4](https://github.com/chrisbenincasa/tunarr/commit/bd65de47147ffef3442f80cd4bd661603de23f7f))
* introduce new default HLS stream mode ([#780](https://github.com/chrisbenincasa/tunarr/issues/780)) ([6e66cfe](https://github.com/chrisbenincasa/tunarr/commit/6e66cfe2f0b7f2b843109f7b5c722c8702c9c027))
* use local file path for plex/jellyfin media if it exists ([#806](https://github.com/chrisbenincasa/tunarr/issues/806)) ([11ca353](https://github.com/chrisbenincasa/tunarr/commit/11ca3532097d0d6969db7fa874374c6abbd2a0fa)), closes [#804](https://github.com/chrisbenincasa/tunarr/issues/804)


### Bug Fixes

* attempts to improve stream stability for mpegts streams ([#801](https://github.com/chrisbenincasa/tunarr/issues/801)) ([ecaddb5](https://github.com/chrisbenincasa/tunarr/commit/ecaddb5c4ca3c72bebc0a83cfee28e83338bae0b))
* do not set programming selector viewType to null ([#812](https://github.com/chrisbenincasa/tunarr/issues/812)) ([37a9fe7](https://github.com/chrisbenincasa/tunarr/commit/37a9fe78c19a92834c4dd72f724b65e55530dbc6)), closes [#808](https://github.com/chrisbenincasa/tunarr/issues/808)
* empty backendUri in general settings is allowed to be empty ([#811](https://github.com/chrisbenincasa/tunarr/issues/811)) ([0924b63](https://github.com/chrisbenincasa/tunarr/commit/0924b6320df215a2b3d1139eba6b2c157e13ee9e)), closes [#747](https://github.com/chrisbenincasa/tunarr/issues/747)
* ensure all tokens are redacted from ffmpeg args, not just the last ([e406cfa](https://github.com/chrisbenincasa/tunarr/commit/e406cfac277e582b6e9a8de930b2e8a2d997c029))
* ensure readahead works for audio+album art and offline streams ([f2f3053](https://github.com/chrisbenincasa/tunarr/commit/f2f305357667ac54392d8f3033332ba58ab57c4e))
* fixes for static image streams for offline mode ([d8238cc](https://github.com/chrisbenincasa/tunarr/commit/d8238cc231042bca30068619f17ca3b6fba76b32))
* handle multiple error events from sessions ([5dfa18f](https://github.com/chrisbenincasa/tunarr/commit/5dfa18f0e4135f52ec2c191ad727be1fb4b8bf1f))
* improvements to stream error and end handling ([d8238cc](https://github.com/chrisbenincasa/tunarr/commit/d8238cc231042bca30068619f17ca3b6fba76b32))
* make link to ffprobe in Docker image ([4111106](https://github.com/chrisbenincasa/tunarr/commit/4111106a8da7e83adaf6ee421b2dca875bb07d39))
* only use reconnect parameters when input source is http(s) ([d8238cc](https://github.com/chrisbenincasa/tunarr/commit/d8238cc231042bca30068619f17ca3b6fba76b32))
* properly reset general form setting values ([51bc998](https://github.com/chrisbenincasa/tunarr/commit/51bc998b718ee1d4cabd1cda618eaaf00cfdbbef))
* revert change to m3u generation -- use ts stream always until we have separate endpoints ([52ebc71](https://github.com/chrisbenincasa/tunarr/commit/52ebc71b06840912df3fc99c863c3fdb9fd2d180))
* use channel's configured streamMode in m3u file; still use mpegts for HDHR ([d8238cc](https://github.com/chrisbenincasa/tunarr/commit/d8238cc231042bca30068619f17ca3b6fba76b32))
* use new mpegts path in hdhr lineup json generation ([#799](https://github.com/chrisbenincasa/tunarr/issues/799)) ([18592d0](https://github.com/chrisbenincasa/tunarr/commit/18592d01f4e9d6fc7b6da6ead3c93ce1f2c4d6b3))
* use new mpegts path in m3u generation ([#798](https://github.com/chrisbenincasa/tunarr/issues/798)) ([e31333a](https://github.com/chrisbenincasa/tunarr/commit/e31333a1392ad1118fc643f7ebb337cc71d70717))

## [0.11.0](https://github.com/chrisbenincasa/tunarr/compare/v0.10.4...v0.11.0) (2024-09-23)


### Features

* add option to use show's poster instead of episode poster ([4f661d5](https://github.com/chrisbenincasa/tunarr/commit/4f661d5c0b0aa01edcb7ad4a9c10fce3faf246ac)), closes [#655](https://github.com/chrisbenincasa/tunarr/issues/655)
* **parity:** support custom shows in time/random slots ([24b5a97](https://github.com/chrisbenincasa/tunarr/commit/24b5a972c3f139168825f5ca55c2f5b7f4891649)), closes [#785](https://github.com/chrisbenincasa/tunarr/issues/785)


### Bug Fixes

* calcuate channel list runtime by selected programs ([24b5a97](https://github.com/chrisbenincasa/tunarr/commit/24b5a972c3f139168825f5ca55c2f5b7f4891649)), closes [#786](https://github.com/chrisbenincasa/tunarr/issues/786)
* hide image cache settings in xmltv as the feature is currently disabled ([4f661d5](https://github.com/chrisbenincasa/tunarr/commit/4f661d5c0b0aa01edcb7ad4a9c10fce3faf246ac))
* simplify query in BackfillProgramGroupings fixer which could cause OOMs ([29956a8](https://github.com/chrisbenincasa/tunarr/commit/29956a81fe7fe5368bcbd3eced86f3829b5acb32)), closes [#788](https://github.com/chrisbenincasa/tunarr/issues/788)
* simplify query in BackfillProgramGroupings fixer which could cause OOMs ([#789](https://github.com/chrisbenincasa/tunarr/issues/789)) ([fd36e38](https://github.com/chrisbenincasa/tunarr/commit/fd36e3850135061e6d82bb8e76fad2d73b9688f0))
* use correct timezone for start time in random slot editor ([24b5a97](https://github.com/chrisbenincasa/tunarr/commit/24b5a972c3f139168825f5ca55c2f5b7f4891649))
* use program_grouping.uuid value as slot program showId, rather than show title ([#792](https://github.com/chrisbenincasa/tunarr/issues/792)) ([24b5a97](https://github.com/chrisbenincasa/tunarr/commit/24b5a972c3f139168825f5ca55c2f5b7f4891649))

## [0.10.4](https://github.com/chrisbenincasa/tunarr/compare/v0.10.3...v0.10.4) (2024-09-21)


### Bug Fixes

* listen on all interfaces (0.0.0.0) by default ([aeddfd5](https://github.com/chrisbenincasa/tunarr/commit/aeddfd59a47dfa2b964c5a42db8516276fb9c8f3)), closes [#777](https://github.com/chrisbenincasa/tunarr/issues/777)
* listen on all interfaces (0.0.0.0) by default ([#778](https://github.com/chrisbenincasa/tunarr/issues/778)) ([f093bc2](https://github.com/chrisbenincasa/tunarr/commit/f093bc2d75b1fd0bdbb065340272c876cbcc2f22))
* macos packaging script pointed to wrong file ([57c02a5](https://github.com/chrisbenincasa/tunarr/commit/57c02a58f822940a12c6d379d6b6edd6d2510826))
* plex playlist children now load in list view ([5f06ae0](https://github.com/chrisbenincasa/tunarr/commit/5f06ae02c23a6096b53c84a378d5b67cc37762a7)), closes [#782](https://github.com/chrisbenincasa/tunarr/issues/782)
* plex playlist children now load in list view ([#783](https://github.com/chrisbenincasa/tunarr/issues/783)) ([f9fdaff](https://github.com/chrisbenincasa/tunarr/commit/f9fdaffc26202175ac77d4afd3013697e53e0a25))

## [0.10.3](https://github.com/chrisbenincasa/tunarr/compare/v0.10.2...v0.10.3) (2024-09-13)


### Bug Fixes

* do not block navigation on time slot editor page after successful save ([a5731cf](https://github.com/chrisbenincasa/tunarr/commit/a5731cfe206a23308c25e7603f4beabbe0a3d3fb))
* properly adjust for timezones in time slot generation/preview ([60f0664](https://github.com/chrisbenincasa/tunarr/commit/60f06645cb83fa427a54edcefef2052b50668f2a))

## [0.10.2](https://github.com/chrisbenincasa/tunarr/compare/v0.10.1...v0.10.2) (2024-09-12)


### Bug Fixes

* ensure that latest tags receive hwaccel build suffix ([9c2e806](https://github.com/chrisbenincasa/tunarr/commit/9c2e806164ece6e621744981d8bcb9d6749e0f5a))

## [0.10.1](https://github.com/chrisbenincasa/tunarr/compare/v0.10.0...v0.10.1) (2024-09-12)


### Bug Fixes

* sessions unable to start after cleaned up ([b84df2f](https://github.com/chrisbenincasa/tunarr/commit/b84df2f8fcdf5a9f953cc0d1a35485cb6ed770a9))
* track channel menu open state per-channel ([2b0a30b](https://github.com/chrisbenincasa/tunarr/commit/2b0a30b5c1d407daf9c70f4909f1b81378aa293b))
* use location.reload over resetRoute until we properly setup error boundaries ([4e44839](https://github.com/chrisbenincasa/tunarr/commit/4e44839457a3571009a7865a63f76fc039a2835e))

## [0.10.0](https://github.com/chrisbenincasa/tunarr/compare/v0.9.1...v0.10.0) (2024-09-10)


### Features

* enable drag'n'drop on custom show page editor ([7c46753](https://github.com/chrisbenincasa/tunarr/commit/7c467532b27a9cf571903a300e8bb63f682855d5))
* major streaming overhaul ([#749](https://github.com/chrisbenincasa/tunarr/issues/749)) ([5ef1fc8](https://github.com/chrisbenincasa/tunarr/commit/5ef1fc8bb872d92f527b784f86aef09e2556b174))
* support movies and custom shows in block shuffle ([c74ba91](https://github.com/chrisbenincasa/tunarr/commit/c74ba9128d4a314ba6d3f4037b120caefa66d699))


### Bug Fixes

* add more structure around sensitive info redaction ([deb8319](https://github.com/chrisbenincasa/tunarr/commit/deb8319f5c42116010508f97cdfaaad88679aa46)), closes [#732](https://github.com/chrisbenincasa/tunarr/issues/732)
* add more structure around sensitive info redaction ([#764](https://github.com/chrisbenincasa/tunarr/issues/764)) ([dfa0820](https://github.com/chrisbenincasa/tunarr/commit/dfa082039beaa6978ebb4ee9fa578c7ecdbcd081)), closes [#732](https://github.com/chrisbenincasa/tunarr/issues/732)
* artificial readrate burst now returns the correct duration for the HLS session ([f47da60](https://github.com/chrisbenincasa/tunarr/commit/f47da608f25eba2a8a9abec50dd691744a4ebcee))
* do not add flex program when channel lineup is cleared ([49253fc](https://github.com/chrisbenincasa/tunarr/commit/49253fc94ae04d283ea2128a7aadd018cec4b979)), closes [#745](https://github.com/chrisbenincasa/tunarr/issues/745)
* do not include width for icons if it is &lt;=0 ([#750](https://github.com/chrisbenincasa/tunarr/issues/750)) ([e4d4ef8](https://github.com/chrisbenincasa/tunarr/commit/e4d4ef86f04c83b2c776fb14e0f22289096c684e))
* fix custom shows in programming selector ([4be7c34](https://github.com/chrisbenincasa/tunarr/commit/4be7c349c306437d3b929002fe393d0a5b335934))
* provide hardcoded width for invalid thumb widths in XMLTV ([#753](https://github.com/chrisbenincasa/tunarr/issues/753)) ([bd40f53](https://github.com/chrisbenincasa/tunarr/commit/bd40f539e3684a9d1ddb1248b04dbb9b73b12ba4))
* remove unnecessary left margin from main content on mobile ([3f4c380](https://github.com/chrisbenincasa/tunarr/commit/3f4c3802c4bdfe83618bdafbe4d4291fdf56875e))
* return custom show programs sorted by index asc ([05e1db3](https://github.com/chrisbenincasa/tunarr/commit/05e1db30aa7870098ef0b39584306d8a4f817846))
* run session cleanup job every minute now that we are defaulting to session based streams ([165327f](https://github.com/chrisbenincasa/tunarr/commit/165327fb69a6f800ff125ea1727ebba090eacbb5))
* set video stream index to account for files with &gt;1 video stream ([065f87c](https://github.com/chrisbenincasa/tunarr/commit/065f87c3f7aa1f11c48332453627c6a22aca61d2)), closes [#758](https://github.com/chrisbenincasa/tunarr/issues/758)
* use correct stream duration value for Plex/Jellyfin streams ([8d559b7](https://github.com/chrisbenincasa/tunarr/commit/8d559b78f6f8e4315a8858bd3988e26c8270411c))
* use stream end event in order to remove session token ([4094dd9](https://github.com/chrisbenincasa/tunarr/commit/4094dd98d7f06ea038d0d46f5df1153afb258c1b))

## [0.9.1](https://github.com/chrisbenincasa/tunarr/compare/v0.9.0...v0.9.1) (2024-08-31)


### Bug Fixes

* transitions between offline still images and video streams resulted in garbled audio ([#739](https://github.com/chrisbenincasa/tunarr/issues/739)) ([ec665e2](https://github.com/chrisbenincasa/tunarr/commit/ec665e279402b518a3ea45a32d280e48a45d3598))

## [0.9.0](https://github.com/chrisbenincasa/tunarr/compare/v0.8.1...v0.9.0) (2024-08-29)


### Features

* add delete confirmation dialog before deleting a filler list + bug fixes ([#726](https://github.com/chrisbenincasa/tunarr/issues/726)) ([a4b6ac6](https://github.com/chrisbenincasa/tunarr/commit/a4b6ac6e3e291c75f238943b15c18aa75ee93122))


### Bug Fixes

* ensure server-scoped Jellyfin API tokens always make requests with user ID ([#729](https://github.com/chrisbenincasa/tunarr/issues/729)) ([78cef1e](https://github.com/chrisbenincasa/tunarr/commit/78cef1edcb20420e4774a78f927ff75e54ab3601))
* ensure that server URLs include http/https protocol ([#722](https://github.com/chrisbenincasa/tunarr/issues/722)) ([3dbc0cd](https://github.com/chrisbenincasa/tunarr/commit/3dbc0cd4116a85983596f869495c6ea93a190d6f))
* remove programs with invalid duration before saving lineup ([#730](https://github.com/chrisbenincasa/tunarr/issues/730)) ([51ceb2b](https://github.com/chrisbenincasa/tunarr/commit/51ceb2bf0b8e9e0bd3a4e1423ad4c30cb519f748))
* use Jellyfin authorization scheme over X-Emby-Token header ([#723](https://github.com/chrisbenincasa/tunarr/issues/723)) ([a5f97fd](https://github.com/chrisbenincasa/tunarr/commit/a5f97fd44845d967128506410eee96951cd4e0f8))

## [0.8.1](https://github.com/chrisbenincasa/tunarr/compare/v0.8.0...v0.8.1) (2024-08-26)


### Bug Fixes

* create temp backup of channel_programs table during migration so references are not deleted ([2d3ff83](https://github.com/chrisbenincasa/tunarr/commit/2d3ff836440ceba0d6b01e82f86fb2c866d3e845))

## [0.8.0](https://github.com/chrisbenincasa/tunarr/compare/v0.7.0...v0.8.0) (2024-08-25)


### ⚠ BREAKING CHANGES

* add support for Jellyfin media ([#633](https://github.com/chrisbenincasa/tunarr/issues/633))

### Features

* add support for Jellyfin media ([#633](https://github.com/chrisbenincasa/tunarr/issues/633)) ([f52df44](https://github.com/chrisbenincasa/tunarr/commit/f52df44ef0f0fa74ef4710f99b3b79b0b470a7e9)), closes [#24](https://github.com/chrisbenincasa/tunarr/issues/24)
* support leading/trailing edge configuration for intermittent watermarks ([#704](https://github.com/chrisbenincasa/tunarr/issues/704)) ([ba2ec87](https://github.com/chrisbenincasa/tunarr/commit/ba2ec877b9f32ce2930ded5118198dab4c9926f4)), closes [#672](https://github.com/chrisbenincasa/tunarr/issues/672)


### Bug Fixes

* custom show editor style and behavior should match fillers ([#715](https://github.com/chrisbenincasa/tunarr/issues/715)) ([b834e1a](https://github.com/chrisbenincasa/tunarr/commit/b834e1af49587648f6db3c394668d0edd10a1e66))
* default fallback image not rendered properly in UI ([#709](https://github.com/chrisbenincasa/tunarr/issues/709)) ([c5d9f43](https://github.com/chrisbenincasa/tunarr/commit/c5d9f4307d5310b185a5fbf0cb468df9aa534df3))
* defer foreign keys in Jellyfin migration due to self-referencing tables ([9462432](https://github.com/chrisbenincasa/tunarr/commit/9462432a92e340b910f7e31346ae3877f1034e3f))
* edited new filler list name reverted after adding programming ([#711](https://github.com/chrisbenincasa/tunarr/issues/711)) ([40f1776](https://github.com/chrisbenincasa/tunarr/commit/40f17765b75ac2b9d72b45f1f552a42e28f29aa8)), closes [#705](https://github.com/chrisbenincasa/tunarr/issues/705)
* generalize media source connection on welcome and settings pages ([#701](https://github.com/chrisbenincasa/tunarr/issues/701)) ([bb1a17f](https://github.com/chrisbenincasa/tunarr/commit/bb1a17f48fc3f67ba2a32ebdf3ba517dbf4221ae))

## [0.7.0](https://github.com/chrisbenincasa/tunarr/compare/v0.6.0...v0.7.0) (2024-08-21)


### Features

* add FWVGA (16:9, 480p) and WVGA (15:9, 480p) resolution options ([#694](https://github.com/chrisbenincasa/tunarr/issues/694)) ([5d24059](https://github.com/chrisbenincasa/tunarr/commit/5d24059e15d3f233cc8db0f08af2b710608df7a6)), closes [#693](https://github.com/chrisbenincasa/tunarr/issues/693)
* convert filler/custom show tables to Tanstack table ([#697](https://github.com/chrisbenincasa/tunarr/issues/697)) ([dc5e346](https://github.com/chrisbenincasa/tunarr/commit/dc5e346bd86b70b4fbbae0ee08ec7d28581a930e))
* replace simple tables in UI with more powerful tanstack table ([#684](https://github.com/chrisbenincasa/tunarr/issues/684)) ([f531b3c](https://github.com/chrisbenincasa/tunarr/commit/f531b3c235447c54aa9b606fd5a5656be49b24e2))

## [0.6.0](https://github.com/chrisbenincasa/tunarr/compare/v0.5.4...v0.6.0) (2024-08-19)


### Features

* add 'Limit' filter option in Plex filter builder ([#690](https://github.com/chrisbenincasa/tunarr/issues/690)) ([9e28e69](https://github.com/chrisbenincasa/tunarr/commit/9e28e695ceb9cb355410488b54ca67be0c672fcc)), closes [#676](https://github.com/chrisbenincasa/tunarr/issues/676)


### Bug Fixes

* make all parent/grandparent plex fields optional ([#686](https://github.com/chrisbenincasa/tunarr/issues/686)) ([dc29742](https://github.com/chrisbenincasa/tunarr/commit/dc29742c62c6ca94a347ecf8712427e031e81211)), closes [#683](https://github.com/chrisbenincasa/tunarr/issues/683)
* various fixes to channel edit form ([#689](https://github.com/chrisbenincasa/tunarr/issues/689)) ([c9784c8](https://github.com/chrisbenincasa/tunarr/commit/c9784c887c087f8a5ed2da0946a1525419cd2e70))

## [0.5.4](https://github.com/chrisbenincasa/tunarr/compare/v0.5.3...v0.5.4) (2024-08-13)


### Bug Fixes

* do not use RouterLink for m3u link on guide page ([8b59a56](https://github.com/chrisbenincasa/tunarr/commit/8b59a56a85266855c33ce9df3782e26ec27a75f4))

## [0.5.3](https://github.com/chrisbenincasa/tunarr/compare/v0.5.2...v0.5.3) (2024-08-13)


### Bug Fixes

* change default watermark preview image URL to use configured ([12ff270](https://github.com/chrisbenincasa/tunarr/commit/12ff2707aebeb1fef2f6dc227975408ff70e6e84))
* channel intermittent watermark default state should be intiialized ([f11e8cf](https://github.com/chrisbenincasa/tunarr/commit/f11e8cfe62a02be753b7b893499b6941399cc405))
* macos entrypoint script can be executed anywhere ([#669](https://github.com/chrisbenincasa/tunarr/issues/669)) ([6d505e9](https://github.com/chrisbenincasa/tunarr/commit/6d505e99cd3c05e03b94a9eb8f03cc162c530cd0)), closes [#668](https://github.com/chrisbenincasa/tunarr/issues/668)
* marks PlexTvShowSchema#Country as optional, like other Plex media Country fields ([#674](https://github.com/chrisbenincasa/tunarr/issues/674)) ([d112c3d](https://github.com/chrisbenincasa/tunarr/commit/d112c3d89bab9db9764c74091386f25a61ca833d)), closes [#670](https://github.com/chrisbenincasa/tunarr/issues/670)

## [0.5.2](https://github.com/chrisbenincasa/tunarr/compare/v0.5.1...v0.5.2) (2024-08-06)


### Bug Fixes

* fix sql query error when querying channel fallback programs ([#661](https://github.com/chrisbenincasa/tunarr/issues/661)) ([16cd085](https://github.com/chrisbenincasa/tunarr/commit/16cd085e1de77484cdb9508271b43bc61fa155f1)), closes [#660](https://github.com/chrisbenincasa/tunarr/issues/660)
* mpegts streams now work even if any HLS streams were started prior ([#663](https://github.com/chrisbenincasa/tunarr/issues/663)) ([d77b0e0](https://github.com/chrisbenincasa/tunarr/commit/d77b0e0b0a8f5b296ac35471c902ef9be7bd7634)), closes [#662](https://github.com/chrisbenincasa/tunarr/issues/662)

## [0.5.1](https://github.com/chrisbenincasa/tunarr/compare/v0.5.0...v0.5.1) (2024-08-05)


### Bug Fixes

* explicitly set file:// scheme on database directories ([#657](https://github.com/chrisbenincasa/tunarr/issues/657)) ([eb5038d](https://github.com/chrisbenincasa/tunarr/commit/eb5038dffad71262b4cb884b26574c3b7884aa40))

## [0.5.0](https://github.com/chrisbenincasa/tunarr/compare/v0.4.2...v0.5.0) (2024-08-04)


### Features

* support for intermittent watermarks ([#644](https://github.com/chrisbenincasa/tunarr/issues/644)) ([9b490b2](https://github.com/chrisbenincasa/tunarr/commit/9b490b275b7182a6c0f0a69f28eb995620a33363)), closes [#492](https://github.com/chrisbenincasa/tunarr/issues/492)


### Bug Fixes

* do not double suffix docker image tags for latest ([8501eca](https://github.com/chrisbenincasa/tunarr/commit/8501eca658a2b4c63edb5417d04618a9ab014f7a))

## [0.4.2](https://github.com/chrisbenincasa/tunarr/compare/tunarr-v0.4.2...tunarr-v0.4.2) (2024-08-04)


### ⚠ BREAKING CHANGES

* use OS-specific, stable path for default Tunarr data directory ([#643](https://github.com/chrisbenincasa/tunarr/issues/643))

### Features

* ability to manually add Plex servers ([#622](https://github.com/chrisbenincasa/tunarr/issues/622)) ([7027efc](https://github.com/chrisbenincasa/tunarr/commit/7027efc0003e8063c57e2c21e1b2952f95942f19))
* add ARM builds ([#618](https://github.com/chrisbenincasa/tunarr/issues/618)) ([c2d5a66](https://github.com/chrisbenincasa/tunarr/commit/c2d5a667b5eea0f81ddf67a7c3a4a22d19dcff5b))
* implement on-demand channels ([#613](https://github.com/chrisbenincasa/tunarr/issues/613)) ([13fe504](https://github.com/chrisbenincasa/tunarr/commit/13fe5043ffd8bdb3c7199d644f210120d908cc5c)), closes [#612](https://github.com/chrisbenincasa/tunarr/issues/612)
* support for intermittent watermarks ([#644](https://github.com/chrisbenincasa/tunarr/issues/644)) ([9b490b2](https://github.com/chrisbenincasa/tunarr/commit/9b490b275b7182a6c0f0a69f28eb995620a33363)), closes [#492](https://github.com/chrisbenincasa/tunarr/issues/492)
* support setting opacity on channel watermarks ([#621](https://github.com/chrisbenincasa/tunarr/issues/621)) ([9480aa2](https://github.com/chrisbenincasa/tunarr/commit/9480aa2af712aebc01647e2cdba8bf84e9a6430a)), closes [#615](https://github.com/chrisbenincasa/tunarr/issues/615)
* use OS-specific, stable path for default Tunarr data directory ([#643](https://github.com/chrisbenincasa/tunarr/issues/643)) ([1c56752](https://github.com/chrisbenincasa/tunarr/commit/1c567525412c5c8df9acf8a37d7ea9331838f319)), closes [#620](https://github.com/chrisbenincasa/tunarr/issues/620)
* **web:** display channel duration and program count on channels page ([#617](https://github.com/chrisbenincasa/tunarr/issues/617)) ([7564a4b](https://github.com/chrisbenincasa/tunarr/commit/7564a4b6587d7f6e3cb951d92de1383e3f1d5c8e))


### Bug Fixes

* ambiguous column error when selecting all filler shows ([#635](https://github.com/chrisbenincasa/tunarr/issues/635)) ([ddb0723](https://github.com/chrisbenincasa/tunarr/commit/ddb0723791a9c9fd22097157f84405aa97ca1776)), closes [#634](https://github.com/chrisbenincasa/tunarr/issues/634)
* cannot use createRequire in web-module; move version function to server ([#641](https://github.com/chrisbenincasa/tunarr/issues/641)) ([7175f15](https://github.com/chrisbenincasa/tunarr/commit/7175f15292dc8133184fce872c2f4ca7a08c6221))
* default disableChannelOverlay to false ([df8192b](https://github.com/chrisbenincasa/tunarr/commit/df8192b26eb82bfe8ba3d9cadf06613fb7e58b5d))
* define platforms for docker edge build workflow ([a1ad921](https://github.com/chrisbenincasa/tunarr/commit/a1ad921c30c5c6aa6349bf372284f4db77823631))
* do not double suffix docker image tags for latest ([8501eca](https://github.com/chrisbenincasa/tunarr/commit/8501eca658a2b4c63edb5417d04618a9ab014f7a))
* double star for tag event? ([2d0fce1](https://github.com/chrisbenincasa/tunarr/commit/2d0fce10dcf6aa3a23de98c5fa96fe3aa7bc5033))
* navigation blocker appeared after channel update ([#645](https://github.com/chrisbenincasa/tunarr/issues/645)) ([a2809d8](https://github.com/chrisbenincasa/tunarr/commit/a2809d8e6703b9729e878821ccbf1a6d182eac58))
* new custom show programming button led to wrong path ([#647](https://github.com/chrisbenincasa/tunarr/issues/647)) ([554a003](https://github.com/chrisbenincasa/tunarr/commit/554a00362d37a54ec733e4f86824214892ce4533))
* properly save filler list / channel associations ([#610](https://github.com/chrisbenincasa/tunarr/issues/610)) ([017eca5](https://github.com/chrisbenincasa/tunarr/commit/017eca5c1e72e668f1c96064569edb8dad1af66c))
* single edge build failure should not affect other builds ([d8840ac](https://github.com/chrisbenincasa/tunarr/commit/d8840accacd103474b64f38ba072824c4fb7633a))
* tag matching in docker release; remove quote and semver specific ([0c45071](https://github.com/chrisbenincasa/tunarr/commit/0c450713e1110ee75455325cd5354c3b8563c40f))
* Use inputted name for new filler lists ([38f76d1](https://github.com/chrisbenincasa/tunarr/commit/38f76d1f33826c75ecfad0f4765fe2d02df04086))
* use PAT for release-please so tag pushes trigger releases ([f8f524d](https://github.com/chrisbenincasa/tunarr/commit/f8f524d588b8a5b45518c7447d53e07abf0d2ab5))
* workaround for macOS binary release ([#608](https://github.com/chrisbenincasa/tunarr/issues/608)) ([8b8f6f8](https://github.com/chrisbenincasa/tunarr/commit/8b8f6f894dd6c77a157efd9a2859cc2ef4b3a8b5))


### Miscellaneous Chores

* manual release ([b24c231](https://github.com/chrisbenincasa/tunarr/commit/b24c2316788c34f71c490549b4e6299a3329ba47))
* manual release ([356249c](https://github.com/chrisbenincasa/tunarr/commit/356249c34b4fd9cf411a4fd1323ff529210e3da3))

## [0.4.2](https://github.com/chrisbenincasa/tunarr/compare/tunarr-v0.4.1...tunarr-v0.4.2) (2024-08-04)


### ⚠ BREAKING CHANGES

* use OS-specific, stable path for default Tunarr data directory ([#643](https://github.com/chrisbenincasa/tunarr/issues/643))

### Features

* ability to manually add Plex servers ([#622](https://github.com/chrisbenincasa/tunarr/issues/622)) ([7027efc](https://github.com/chrisbenincasa/tunarr/commit/7027efc0003e8063c57e2c21e1b2952f95942f19))
* add ARM builds ([#618](https://github.com/chrisbenincasa/tunarr/issues/618)) ([c2d5a66](https://github.com/chrisbenincasa/tunarr/commit/c2d5a667b5eea0f81ddf67a7c3a4a22d19dcff5b))
* implement on-demand channels ([#613](https://github.com/chrisbenincasa/tunarr/issues/613)) ([13fe504](https://github.com/chrisbenincasa/tunarr/commit/13fe5043ffd8bdb3c7199d644f210120d908cc5c)), closes [#612](https://github.com/chrisbenincasa/tunarr/issues/612)
* support setting opacity on channel watermarks ([#621](https://github.com/chrisbenincasa/tunarr/issues/621)) ([9480aa2](https://github.com/chrisbenincasa/tunarr/commit/9480aa2af712aebc01647e2cdba8bf84e9a6430a)), closes [#615](https://github.com/chrisbenincasa/tunarr/issues/615)
* use OS-specific, stable path for default Tunarr data directory ([#643](https://github.com/chrisbenincasa/tunarr/issues/643)) ([1c56752](https://github.com/chrisbenincasa/tunarr/commit/1c567525412c5c8df9acf8a37d7ea9331838f319)), closes [#620](https://github.com/chrisbenincasa/tunarr/issues/620)
* **web:** display channel duration and program count on channels page ([#617](https://github.com/chrisbenincasa/tunarr/issues/617)) ([7564a4b](https://github.com/chrisbenincasa/tunarr/commit/7564a4b6587d7f6e3cb951d92de1383e3f1d5c8e))


### Bug Fixes

* ambiguous column error when selecting all filler shows ([#635](https://github.com/chrisbenincasa/tunarr/issues/635)) ([ddb0723](https://github.com/chrisbenincasa/tunarr/commit/ddb0723791a9c9fd22097157f84405aa97ca1776)), closes [#634](https://github.com/chrisbenincasa/tunarr/issues/634)
* cannot use createRequire in web-module; move version function to server ([#641](https://github.com/chrisbenincasa/tunarr/issues/641)) ([7175f15](https://github.com/chrisbenincasa/tunarr/commit/7175f15292dc8133184fce872c2f4ca7a08c6221))
* default disableChannelOverlay to false ([df8192b](https://github.com/chrisbenincasa/tunarr/commit/df8192b26eb82bfe8ba3d9cadf06613fb7e58b5d))
* define platforms for docker edge build workflow ([a1ad921](https://github.com/chrisbenincasa/tunarr/commit/a1ad921c30c5c6aa6349bf372284f4db77823631))
* double star for tag event? ([2d0fce1](https://github.com/chrisbenincasa/tunarr/commit/2d0fce10dcf6aa3a23de98c5fa96fe3aa7bc5033))
* navigation blocker appeared after channel update ([#645](https://github.com/chrisbenincasa/tunarr/issues/645)) ([a2809d8](https://github.com/chrisbenincasa/tunarr/commit/a2809d8e6703b9729e878821ccbf1a6d182eac58))
* new custom show programming button led to wrong path ([#647](https://github.com/chrisbenincasa/tunarr/issues/647)) ([554a003](https://github.com/chrisbenincasa/tunarr/commit/554a00362d37a54ec733e4f86824214892ce4533))
* properly save filler list / channel associations ([#610](https://github.com/chrisbenincasa/tunarr/issues/610)) ([017eca5](https://github.com/chrisbenincasa/tunarr/commit/017eca5c1e72e668f1c96064569edb8dad1af66c))
* single edge build failure should not affect other builds ([d8840ac](https://github.com/chrisbenincasa/tunarr/commit/d8840accacd103474b64f38ba072824c4fb7633a))
* tag matching in docker release; remove quote and semver specific ([0c45071](https://github.com/chrisbenincasa/tunarr/commit/0c450713e1110ee75455325cd5354c3b8563c40f))
* Use inputted name for new filler lists ([38f76d1](https://github.com/chrisbenincasa/tunarr/commit/38f76d1f33826c75ecfad0f4765fe2d02df04086))
* use PAT for release-please so tag pushes trigger releases ([f8f524d](https://github.com/chrisbenincasa/tunarr/commit/f8f524d588b8a5b45518c7447d53e07abf0d2ab5))
* workaround for macOS binary release ([#608](https://github.com/chrisbenincasa/tunarr/issues/608)) ([8b8f6f8](https://github.com/chrisbenincasa/tunarr/commit/8b8f6f894dd6c77a157efd9a2859cc2ef4b3a8b5))


### Miscellaneous Chores

* manual release ([b24c231](https://github.com/chrisbenincasa/tunarr/commit/b24c2316788c34f71c490549b4e6299a3329ba47))
* manual release ([356249c](https://github.com/chrisbenincasa/tunarr/commit/356249c34b4fd9cf411a4fd1323ff529210e3da3))

## [0.4.1](https://github.com/chrisbenincasa/tunarr/compare/v0.4.0...v0.4.1) (2024-08-03)


### Bug Fixes

* navigation blocker appeared after channel update ([#645](https://github.com/chrisbenincasa/tunarr/issues/645)) ([a2809d8](https://github.com/chrisbenincasa/tunarr/commit/a2809d8e6703b9729e878821ccbf1a6d182eac58))
* new custom show programming button led to wrong path ([#647](https://github.com/chrisbenincasa/tunarr/issues/647)) ([554a003](https://github.com/chrisbenincasa/tunarr/commit/554a00362d37a54ec733e4f86824214892ce4533))

## [0.4.0](https://github.com/chrisbenincasa/tunarr/compare/v0.3.2...v0.4.0) (2024-08-03)


### ⚠ BREAKING CHANGES

* use OS-specific, stable path for default Tunarr data directory ([#643](https://github.com/chrisbenincasa/tunarr/issues/643))

### Features

* use OS-specific, stable path for default Tunarr data directory ([#643](https://github.com/chrisbenincasa/tunarr/issues/643)) ([1c56752](https://github.com/chrisbenincasa/tunarr/commit/1c567525412c5c8df9acf8a37d7ea9331838f319)), closes [#620](https://github.com/chrisbenincasa/tunarr/issues/620)


### Bug Fixes

* cannot use createRequire in web-module; move version function to server ([#641](https://github.com/chrisbenincasa/tunarr/issues/641)) ([7175f15](https://github.com/chrisbenincasa/tunarr/commit/7175f15292dc8133184fce872c2f4ca7a08c6221))


### Miscellaneous Chores

* manual release ([356249c](https://github.com/chrisbenincasa/tunarr/commit/356249c34b4fd9cf411a4fd1323ff529210e3da3))

## [0.3.2](https://github.com/chrisbenincasa/tunarr/compare/v0.3.1...v0.3.2) (2024-07-24)


### Bug Fixes

* ambiguous column error when selecting all filler shows ([#635](https://github.com/chrisbenincasa/tunarr/issues/635)) ([ddb0723](https://github.com/chrisbenincasa/tunarr/commit/ddb0723791a9c9fd22097157f84405aa97ca1776)), closes [#634](https://github.com/chrisbenincasa/tunarr/issues/634)

## [0.3.1](https://github.com/chrisbenincasa/tunarr/compare/v0.3.0...v0.3.1) (2024-07-17)


### Bug Fixes

* use PAT for release-please so tag pushes trigger releases ([f8f524d](https://github.com/chrisbenincasa/tunarr/commit/f8f524d588b8a5b45518c7447d53e07abf0d2ab5))

## [0.3.0](https://github.com/chrisbenincasa/tunarr/compare/tunarr-v0.2.0...tunarr-v0.3.0) (2024-07-17)


### Features

* ability to manually add Plex servers ([#622](https://github.com/chrisbenincasa/tunarr/issues/622)) ([7027efc](https://github.com/chrisbenincasa/tunarr/commit/7027efc0003e8063c57e2c21e1b2952f95942f19))
* add ARM builds ([#618](https://github.com/chrisbenincasa/tunarr/issues/618)) ([c2d5a66](https://github.com/chrisbenincasa/tunarr/commit/c2d5a667b5eea0f81ddf67a7c3a4a22d19dcff5b))
* implement on-demand channels ([#613](https://github.com/chrisbenincasa/tunarr/issues/613)) ([13fe504](https://github.com/chrisbenincasa/tunarr/commit/13fe5043ffd8bdb3c7199d644f210120d908cc5c)), closes [#612](https://github.com/chrisbenincasa/tunarr/issues/612)
* support setting opacity on channel watermarks ([#621](https://github.com/chrisbenincasa/tunarr/issues/621)) ([9480aa2](https://github.com/chrisbenincasa/tunarr/commit/9480aa2af712aebc01647e2cdba8bf84e9a6430a)), closes [#615](https://github.com/chrisbenincasa/tunarr/issues/615)
* **web:** display channel duration and program count on channels page ([#617](https://github.com/chrisbenincasa/tunarr/issues/617)) ([7564a4b](https://github.com/chrisbenincasa/tunarr/commit/7564a4b6587d7f6e3cb951d92de1383e3f1d5c8e))


### Bug Fixes

* default disableChannelOverlay to false ([df8192b](https://github.com/chrisbenincasa/tunarr/commit/df8192b26eb82bfe8ba3d9cadf06613fb7e58b5d))
* define platforms for docker edge build workflow ([a1ad921](https://github.com/chrisbenincasa/tunarr/commit/a1ad921c30c5c6aa6349bf372284f4db77823631))
* double star for tag event? ([2d0fce1](https://github.com/chrisbenincasa/tunarr/commit/2d0fce10dcf6aa3a23de98c5fa96fe3aa7bc5033))
* properly save filler list / channel associations ([#610](https://github.com/chrisbenincasa/tunarr/issues/610)) ([017eca5](https://github.com/chrisbenincasa/tunarr/commit/017eca5c1e72e668f1c96064569edb8dad1af66c))
* single edge build failure should not affect other builds ([d8840ac](https://github.com/chrisbenincasa/tunarr/commit/d8840accacd103474b64f38ba072824c4fb7633a))
* tag matching in docker release; remove quote and semver specific ([0c45071](https://github.com/chrisbenincasa/tunarr/commit/0c450713e1110ee75455325cd5354c3b8563c40f))
* Use inputted name for new filler lists ([38f76d1](https://github.com/chrisbenincasa/tunarr/commit/38f76d1f33826c75ecfad0f4765fe2d02df04086))
* workaround for macOS binary release ([#608](https://github.com/chrisbenincasa/tunarr/issues/608)) ([8b8f6f8](https://github.com/chrisbenincasa/tunarr/commit/8b8f6f894dd6c77a157efd9a2859cc2ef4b3a8b5))
