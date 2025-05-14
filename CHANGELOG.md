# Changelog

## [0.19.3](https://github.com/chrisbenincasa/tunarr/compare/v0.19.2...v0.19.3) (2025-05-12)


### Bug Fixes

* fix tv guide current time indicator alignment ([c74aa14](https://github.com/chrisbenincasa/tunarr/commit/c74aa146f6067273d9c5b8b48fb14344cba295aa))

## [0.19.2](https://github.com/chrisbenincasa/tunarr/compare/v0.19.1...v0.19.2) (2025-05-12)


### Features

* add ability to duplicate a channel ([#1187](https://github.com/chrisbenincasa/tunarr/issues/1187)) ([707a814](https://github.com/chrisbenincasa/tunarr/commit/707a81439d38b803af7e2f11c1d850e91b3eed43))


### Bug Fixes

* fix select all for Jellyfin libraries ([c872ad9](https://github.com/chrisbenincasa/tunarr/commit/c872ad98bc8d8d3690c9cbdbc71f0c44d1914e30))


### UI Changes

* add loading indicator when adding selected media to channel ([50344a4](https://github.com/chrisbenincasa/tunarr/commit/50344a4d62feced355cca77cdaa57e5b0fba5a64))

## [0.19.1](https://github.com/chrisbenincasa/tunarr/compare/v0.19.0...v0.19.1) (2025-05-09)


### Bug Fixes

* allow adding Jellyfin media of type Video/MusicVideo ([ff3ad43](https://github.com/chrisbenincasa/tunarr/commit/ff3ad43d1f4e385d1abb7dc3c30da3a274f72c59)), closes [#862](https://github.com/chrisbenincasa/tunarr/issues/862)
* default backup path to tunarr data directory when unset ([#1183](https://github.com/chrisbenincasa/tunarr/issues/1183)) ([daf6d34](https://github.com/chrisbenincasa/tunarr/commit/daf6d3434655c44d47dbce3d02b37ada61cf3049))
* do not hit non-existent /Users/Me endpoint for Emby ([e93ffe3](https://github.com/chrisbenincasa/tunarr/commit/e93ffe34df7a2f94ce698c9dcab86e1abafda3a2))
* fix new sticky header for Jellyfin/Emby program selectors ([#1185](https://github.com/chrisbenincasa/tunarr/issues/1185)) ([cecdecb](https://github.com/chrisbenincasa/tunarr/commit/cecdecbd66ae2497757925cd86e240b0d3e98efe))
* properly handle boolean Plex filters ([#1186](https://github.com/chrisbenincasa/tunarr/issues/1186)) ([53307f8](https://github.com/chrisbenincasa/tunarr/commit/53307f81efbd80305ecd5217e296cd1d4c98f0f3))
* remove erroneous flashing 0 when switching media sources ([f075b15](https://github.com/chrisbenincasa/tunarr/commit/f075b1576640146f1e4611edef0215259d1c0fc1))


### UI Changes

* add weekday headers to time slot scheduler ([#1184](https://github.com/chrisbenincasa/tunarr/issues/1184)) ([caf4200](https://github.com/chrisbenincasa/tunarr/commit/caf420066109ce866ec74b95390a2cbc56c6d9d6))
* added sticky bar for programming selector actions ([ac93725](https://github.com/chrisbenincasa/tunarr/commit/ac937257e980bfada305752280125e3ec2256c42))

## [0.19.0](https://github.com/chrisbenincasa/tunarr/compare/v0.18.20...v0.19.0) (2025-05-05)


### ⚠ BREAKING CHANGES

* properly scope Jellyfin/Emby requests to the auth'd user ([#1163](https://github.com/chrisbenincasa/tunarr/issues/1163))

### Features

* add safe title area indicator on watermark page ([#1177](https://github.com/chrisbenincasa/tunarr/issues/1177)) ([474331e](https://github.com/chrisbenincasa/tunarr/commit/474331e683a77567927901cde0df0dc265ca60e9))
* improvements to restrict hours tool ([#1165](https://github.com/chrisbenincasa/tunarr/issues/1165)) ([0065e2b](https://github.com/chrisbenincasa/tunarr/commit/0065e2b97686dd72de3d67e3e2f3fdb42298fedf)), closes [#1159](https://github.com/chrisbenincasa/tunarr/issues/1159)


### Bug Fixes

* always pass mediaSourceUuid for api clients created from sources ([8c2653c](https://github.com/chrisbenincasa/tunarr/commit/8c2653c4fdf15e19343a628bf3b5c2336af4af20))
* do not allow start time padding to skew ([384ff75](https://github.com/chrisbenincasa/tunarr/commit/384ff75b404fc19d1365f7efb49d36c52ea4c3a0)), closes [#1175](https://github.com/chrisbenincasa/tunarr/issues/1175)
* fix drawer subnav expansion ([82ca195](https://github.com/chrisbenincasa/tunarr/commit/82ca1950d7a9a134ae8b0ff82312c6a27eb3f183))
* fix erroneous "unsaved changes" warning on ffmpeg page ([e5bd022](https://github.com/chrisbenincasa/tunarr/commit/e5bd022e105070b703d89326dfb7678239b70bbf))
* get all tests passing and fix db migration bug ([c998163](https://github.com/chrisbenincasa/tunarr/commit/c99816373c5ec4b9d5b0a385f08898b8816ba435))
* improve Nvidia card name detection and debug output ([0495023](https://github.com/chrisbenincasa/tunarr/commit/04950234a1776d79ac298627156721cbf59644ea))
* properly scope Jellyfin/Emby requests to the auth'd user ([#1163](https://github.com/chrisbenincasa/tunarr/issues/1163)) ([d9483f4](https://github.com/chrisbenincasa/tunarr/commit/d9483f4036fed8d48431dfd674ff521e407686aa))
* re-add program_external_id indexes, removed by mistake ([d2338f7](https://github.com/chrisbenincasa/tunarr/commit/d2338f7d96062eed08a582de1fdde52a67d9066f))
* remove unusable drag indicator in time slot table ([541e650](https://github.com/chrisbenincasa/tunarr/commit/541e6506e4a9ea97c3b49f2d19dbca365c412755)), closes [#1158](https://github.com/chrisbenincasa/tunarr/issues/1158)
* set recursive=true certain types of Jellyfin "libraries" ([#1168](https://github.com/chrisbenincasa/tunarr/issues/1168)) ([8f81791](https://github.com/chrisbenincasa/tunarr/commit/8f817917f3b1eb40e718a415fe6922ddd47a2695))
* support Jellyfin mixed library types ([#1171](https://github.com/chrisbenincasa/tunarr/issues/1171)) ([222b0bb](https://github.com/chrisbenincasa/tunarr/commit/222b0bbaeb35120e1069b1bad2186c57092f8a31))

## [0.18.20](https://github.com/chrisbenincasa/tunarr/compare/v0.18.19...v0.18.20) (2025-04-17)


### Bug Fixes

* disable filtering on non-library tabs ([14b591c](https://github.com/chrisbenincasa/tunarr/commit/14b591c767fd9e81dadd9e99c694ccb356067710))
* fix weekly calendar view stack overflow error ([c928bb8](https://github.com/chrisbenincasa/tunarr/commit/c928bb8992f01d0c957c09bac620aa0e2af10345))

## [0.18.19](https://github.com/chrisbenincasa/tunarr/compare/v0.18.18...v0.18.19) (2025-04-14)


### Bug Fixes

* properly write m3u8 playlist string in response ([83269d1](https://github.com/chrisbenincasa/tunarr/commit/83269d13b678196a5a93bb9d1ae158620fe4adba))

## [0.18.18](https://github.com/chrisbenincasa/tunarr/compare/v0.18.17...v0.18.18) (2025-04-14)


### Bug Fixes

* fix updating plex play status during stream ([f90f271](https://github.com/chrisbenincasa/tunarr/commit/f90f271c91783780e53b0c3c07140c6a54a5813d))
* improve error logging and handling when HLS playlists are not found ([a3e806c](https://github.com/chrisbenincasa/tunarr/commit/a3e806ca7f68c220d1d0ad308dd3b24d2a7dd49b))
* properly detect when running in a Podman container ([d53ec45](https://github.com/chrisbenincasa/tunarr/commit/d53ec450fe2d32a9340f0bae2a8d14f76c0e5aa9)), closes [#1147](https://github.com/chrisbenincasa/tunarr/issues/1147)
* redact errors to /Users call in JellyfinApiClient ([5296259](https://github.com/chrisbenincasa/tunarr/commit/529625954000ff042c0cc0352a550f03bd7870b5)), closes [#1136](https://github.com/chrisbenincasa/tunarr/issues/1136)
* show delete confirmation before deleting a custom show ([3dc56d6](https://github.com/chrisbenincasa/tunarr/commit/3dc56d6d5fc8d49578e7c1ba635477003016fb48))


### UI Changes

* calendar style tweaks ([9917af9](https://github.com/chrisbenincasa/tunarr/commit/9917af97ca59c85d6ae390b851d713647e99198d))

## [0.18.17](https://github.com/chrisbenincasa/tunarr/compare/v0.18.16...v0.18.17) (2025-04-10)


### Features

* add calendar views for channel programming ([#1134](https://github.com/chrisbenincasa/tunarr/issues/1134)) ([8e8d10e](https://github.com/chrisbenincasa/tunarr/commit/8e8d10e6757c57ce8c5da74c3104a0e181933825))
* add flag for enabling trust proxy ([#1140](https://github.com/chrisbenincasa/tunarr/issues/1140)) ([718af48](https://github.com/chrisbenincasa/tunarr/commit/718af48a1863351db5b7882d5d6fce4129222727))
* support in-order slot scheduling ([#1132](https://github.com/chrisbenincasa/tunarr/issues/1132)) ([a8a5d52](https://github.com/chrisbenincasa/tunarr/commit/a8a5d5224cc990019ddc6bdb7db46024c1fb1e58))
* support setting preferred theme setting to 'system' ([#1137](https://github.com/chrisbenincasa/tunarr/issues/1137)) ([9ad0a9b](https://github.com/chrisbenincasa/tunarr/commit/9ad0a9bbfa9f56124408e0df9c6c7d069c10fed1))


### Bug Fixes

* do not reset channel pagination state when data updates in background ([40a5984](https://github.com/chrisbenincasa/tunarr/commit/40a59849e385548300627537c5116bf1777b7206))
* fix copy-to-clipboard links from top bar ([424b494](https://github.com/chrisbenincasa/tunarr/commit/424b49439162e6895f92aed6ebeb0c3ac85ec530))
* fixes to rendering paused on-demand guides ([1d67a3d](https://github.com/chrisbenincasa/tunarr/commit/1d67a3df0c1c6a205afc5e381b25400e5877474a))
* use correct state in dark mode selectors ([b3217ba](https://github.com/chrisbenincasa/tunarr/commit/b3217ba4fca927e8648656e1aba7cb0d585d4fdc))


### UI Changes

* fixes to colorization in dark mode ([#1143](https://github.com/chrisbenincasa/tunarr/issues/1143)) ([f7dfe39](https://github.com/chrisbenincasa/tunarr/commit/f7dfe3931541e9fee2c51eaf9ae6ed6521069903))
* make settings link last in side drawer ([a81c02e](https://github.com/chrisbenincasa/tunarr/commit/a81c02e21145ca47bdf59db3e70e7593156b16ad))

## [0.18.16](https://github.com/chrisbenincasa/tunarr/compare/v0.18.15...v0.18.16) (2025-03-27)


### Features

* ability to set the transcode output path ([#1129](https://github.com/chrisbenincasa/tunarr/issues/1129)) ([539df9f](https://github.com/chrisbenincasa/tunarr/commit/539df9f8038931d41add673ae435f12cdb02851f))
* add system logs page ([#1130](https://github.com/chrisbenincasa/tunarr/issues/1130)) ([c166acb](https://github.com/chrisbenincasa/tunarr/commit/c166acb83a564d45b378a24436dd34b24f1093c9))
* show channel active session indicator ([#1123](https://github.com/chrisbenincasa/tunarr/issues/1123)) ([a60d200](https://github.com/chrisbenincasa/tunarr/commit/a60d2008094eecf289af1596d9e4c1b45c37a515))


### Bug Fixes

* convert 10-bit inputs to 8-bit before using overlay_cuda filter ([#1125](https://github.com/chrisbenincasa/tunarr/issues/1125)) ([98d2070](https://github.com/chrisbenincasa/tunarr/commit/98d2070624728255de6531b1cc313e476fc9f266))
* guide/epg now accurately reflects state of on-demand channels ([#978](https://github.com/chrisbenincasa/tunarr/issues/978)) ([79c6a69](https://github.com/chrisbenincasa/tunarr/commit/79c6a69e8d0ade55ddc8b878cdf3f17e6a2d91d4))
* random slot schedule preset should set all relevant fields in form ([9a4d67f](https://github.com/chrisbenincasa/tunarr/commit/9a4d67f4dfd7650c82fdcd4cdb0ec679e4fc424c)), closes [#1122](https://github.com/chrisbenincasa/tunarr/issues/1122)

## [0.18.15](https://github.com/chrisbenincasa/tunarr/compare/v0.18.14...v0.18.15) (2025-03-11)


### Features

* update primary button in add media button group after selection ([#1114](https://github.com/chrisbenincasa/tunarr/issues/1114)) ([45e1fc5](https://github.com/chrisbenincasa/tunarr/commit/45e1fc5a2d55113fec3b550f883fa428ce93fee7))


### Bug Fixes

* re-add media_source unique index ([d874b9b](https://github.com/chrisbenincasa/tunarr/commit/d874b9b2f51267fd381e88b87868f505b229a777))

## [0.18.14](https://github.com/chrisbenincasa/tunarr/compare/v0.18.13...v0.18.14) (2025-03-06)


### Bug Fixes

* add indexes for external ids to improve various queries ([91d654d](https://github.com/chrisbenincasa/tunarr/commit/91d654d4f9b8f48a6e83789fa12c86ac78f89d3b))
* install ldid on binary build github action to properly codesign macos-arm binaries ([e442e70](https://github.com/chrisbenincasa/tunarr/commit/e442e70737d71aa1b47eca90f450ef1dd4d3531f))

## [0.18.13](https://github.com/chrisbenincasa/tunarr/compare/v0.18.12...v0.18.13) (2025-03-03)


### Features

* show version mismatch warning on frontend ([4c534ce](https://github.com/chrisbenincasa/tunarr/commit/4c534ce922a713e8423c6e851a474034180613df))


### Bug Fixes

* fix ARM Docker builds; use the ARM executable artifact name ([7d246f4](https://github.com/chrisbenincasa/tunarr/commit/7d246f4bd50ffb2fe410874f8765597fcf8cd863))
* fix DB copy migrator on Windows ([#1111](https://github.com/chrisbenincasa/tunarr/issues/1111)) ([e440380](https://github.com/chrisbenincasa/tunarr/commit/e4403802f978fa531b918b313266669e436743d3))
* properly regenerate relevant XMLTV bits when channel configs change ([6ee1b1c](https://github.com/chrisbenincasa/tunarr/commit/6ee1b1cb5a5eb477956b8ebe582f089b52639cc6))
* run Docker ARM builds on an ARM machine ([#1107](https://github.com/chrisbenincasa/tunarr/issues/1107)) ([5086ae3](https://github.com/chrisbenincasa/tunarr/commit/5086ae3ce0e501924d2a08eae4f8e75540e58c0b))
* updating channel number properly refreshes XMLTV ([4c40190](https://github.com/chrisbenincasa/tunarr/commit/4c401905e46136371925d7cf0a75e13426c46032))

## [0.18.12](https://github.com/chrisbenincasa/tunarr/compare/v0.18.11...v0.18.12) (2025-02-27)


### Features

* support Emby as a media source ([#1085](https://github.com/chrisbenincasa/tunarr/issues/1085)) ([a918176](https://github.com/chrisbenincasa/tunarr/commit/a918176a3bdf5751f4240e15548d8dafc3bb760e))
* support Emby as a media source ([#1101](https://github.com/chrisbenincasa/tunarr/issues/1101)) ([846ed27](https://github.com/chrisbenincasa/tunarr/commit/846ed27498485f1f13c5f3d293ed337b1b67a693))


### Bug Fixes

* allow scheduling custom shows that contain the same programs ([#1102](https://github.com/chrisbenincasa/tunarr/issues/1102)) ([ea78d1c](https://github.com/chrisbenincasa/tunarr/commit/ea78d1c1ddc6cfe8d42ec513870bf2ec87481f8d))
* copy temp db file instead of renaming to avoid cross-link errors ([c7a90f1](https://github.com/chrisbenincasa/tunarr/commit/c7a90f1b28782f271760f461f9b4e8c14078add5))
* do not sort programs when block shuffling in random mode ([e072e54](https://github.com/chrisbenincasa/tunarr/commit/e072e54eb502b7a4f3a483945ed7d705d6ebb0df))
* fix filler list delete confirmation dialog nav ([651d236](https://github.com/chrisbenincasa/tunarr/commit/651d236763b651f4676afbe4be0e06e1c1ec8926))
* handle case where initial DB migration was not run yet ([70789ef](https://github.com/chrisbenincasa/tunarr/commit/70789efddbded37484de4c9293161e6ae78e7fec))


### UI Changes

* add breadcrumbs to transcode config page ([95f4456](https://github.com/chrisbenincasa/tunarr/commit/95f4456a5cafa24919a6df5811e4d1eed7d3e74d))

## [0.18.11](https://github.com/chrisbenincasa/tunarr/compare/v0.18.10...v0.18.11) (2025-02-16)


### Features

* ability to set the server port in the UI ([#1096](https://github.com/chrisbenincasa/tunarr/issues/1096)) ([3b65ccd](https://github.com/chrisbenincasa/tunarr/commit/3b65ccdff3fb79bf65c03b51b3c52fe2ee1b20b3))
* **backend:** support "append" parameter for programming lineup update requests ([be55db2](https://github.com/chrisbenincasa/tunarr/commit/be55db276247d436e29d9a2189c333e70b042761))


### Bug Fixes

* fix legacy channel migrator to only insert channel filler shows if they exist ([e184540](https://github.com/chrisbenincasa/tunarr/commit/e1845405768653ab7881ad948a2e3d5cf85b6f75))
* fix media_source insert query in legacy migrator to use correct index ([aa069d3](https://github.com/chrisbenincasa/tunarr/commit/aa069d3429debcab0a67d57ebdff54b41345660c))
* remove Bun and rollback to Node 22.13.1 ([#1095](https://github.com/chrisbenincasa/tunarr/issues/1095)) ([e803946](https://github.com/chrisbenincasa/tunarr/commit/e803946d6fc4296fe5685f27cd542c1e6cce8ef7))


### Performance Improvements

* fix channel lineup update performance regression from bun conversion ([2aecc71](https://github.com/chrisbenincasa/tunarr/commit/2aecc71da914e30b454e0927fee899adbefaff61)), closes [#1093](https://github.com/chrisbenincasa/tunarr/issues/1093)


### UI Changes

* add data directory location to system status page ([99c69b3](https://github.com/chrisbenincasa/tunarr/commit/99c69b3ff7a575fd338c6d0debc1062c32584ffa))

## [0.18.10](https://github.com/chrisbenincasa/tunarr/compare/v0.18.9...v0.18.10) (2025-02-12)


### Features

* add support for older CPUs (pre-2013) on bun builds ([066a538](https://github.com/chrisbenincasa/tunarr/commit/066a538a5c20f7627ac0c27105a41e5bfea6214f))


### Bug Fixes

* fix docker build args for new baseline builds ([deacd3d](https://github.com/chrisbenincasa/tunarr/commit/deacd3dd11144b760e47c4a991a10f3a962692d5))

## [0.18.9](https://github.com/chrisbenincasa/tunarr/compare/v0.18.8...v0.18.9) (2025-02-12)


### Bug Fixes

* fix release builds for docker and simplify ([41f0cee](https://github.com/chrisbenincasa/tunarr/commit/41f0cee40c60aedfc79914db566f7589162bb051))

## [0.18.8](https://github.com/chrisbenincasa/tunarr/compare/v0.18.7...v0.18.8) (2025-02-07)


### Features

* add basic sorting tools for custom shows ([#1079](https://github.com/chrisbenincasa/tunarr/issues/1079)) ([24e9e37](https://github.com/chrisbenincasa/tunarr/commit/24e9e37a38462d933c966aa7142cc7daad385578))
* add separate system page with new system debug page ([#1084](https://github.com/chrisbenincasa/tunarr/issues/1084)) ([03f6b78](https://github.com/chrisbenincasa/tunarr/commit/03f6b786108926c3d53f0bcfad55b20aefcda67e))
* show changelog on main page ([#1081](https://github.com/chrisbenincasa/tunarr/issues/1081)) ([cee2c78](https://github.com/chrisbenincasa/tunarr/commit/cee2c7837c196564eca0a81d332c03b2cfc38e91))


### Bug Fixes

* attach image to xmltv program entries ([d039d45](https://github.com/chrisbenincasa/tunarr/commit/d039d451db45af76cd9de176f1f4130c80ce1fbd))
* disable limit on update/delete queries ([#1077](https://github.com/chrisbenincasa/tunarr/issues/1077)) ([2b37fe0](https://github.com/chrisbenincasa/tunarr/commit/2b37fe0304c6501d7401315c1e90e080625ff801))
* fix copyToClipboard for xmltv/m3u links (again) ([ff08303](https://github.com/chrisbenincasa/tunarr/commit/ff08303f2bfbd6e7a8b5c0e090f7e2facb595cc5))
* fix typo in vacuum for new sqlite backup method ([d648e1e](https://github.com/chrisbenincasa/tunarr/commit/d648e1e1554d0a5fc644845b07fc60e82ae0115b))
* use fps_mode instead of vsync when specifying frame rate ([3198481](https://github.com/chrisbenincasa/tunarr/commit/31984812892f480769e63054c647e125d61f80ed))

## [0.18.7](https://github.com/chrisbenincasa/tunarr/compare/v0.18.6...v0.18.7) (2025-01-29)


### Bug Fixes

* fix remote watermark local file caching ([d726d51](https://github.com/chrisbenincasa/tunarr/commit/d726d51b96c2ed7cb0994a0ea429bdd0f4630748))
* properly create tunarr database directory on first run ([db97e57](https://github.com/chrisbenincasa/tunarr/commit/db97e574c5aeffae769b3f00bfb4942f74771a30))
* properly detect capability to encode 8-bit HEVC from vainfo ([b645c88](https://github.com/chrisbenincasa/tunarr/commit/b645c88c23726a700acf91862619d3cd8fdaefc3))
* properly inject program converter to programdb ([cfc3127](https://github.com/chrisbenincasa/tunarr/commit/cfc31271e05a38b61836f4b5c2528339f8232ad7))
* use revision instead of last version for binary edge builds ([0025bc6](https://github.com/chrisbenincasa/tunarr/commit/0025bc6cd6c8872b867b3cde90748f740b81a0a2))

## [0.18.6](https://github.com/chrisbenincasa/tunarr/compare/v0.18.5...v0.18.6) (2025-01-25)


### Bug Fixes

* fix bundled build; apparently only works with a TS entrypoint with esbuild ([3dcf327](https://github.com/chrisbenincasa/tunarr/commit/3dcf327e308fd4ed4d92909cbe2e17e3b321c711))

## [0.18.5](https://github.com/chrisbenincasa/tunarr/compare/v0.18.4...v0.18.5) (2025-01-24)


### Features

* ability to duplicate transcode configs ([#1067](https://github.com/chrisbenincasa/tunarr/issues/1067)) ([4ede70f](https://github.com/chrisbenincasa/tunarr/commit/4ede70fa81aa3fc89c8139e040d43fb706f337c2))


### Bug Fixes

* actually bind the server ([fb9abf0](https://github.com/chrisbenincasa/tunarr/commit/fb9abf02d7e1831c5265ee0e4be909bd361f4e2b))
* display show name properly in RemoveShowsModal ([b09ea55](https://github.com/chrisbenincasa/tunarr/commit/b09ea55a4c43c88ff764dd4427794f903b36136b))
* potential fixes/workarounds for quicksync audio sync issues ([#1069](https://github.com/chrisbenincasa/tunarr/issues/1069)) ([93141ba](https://github.com/chrisbenincasa/tunarr/commit/93141ba4380fd728e04c8abca37c7f5a1b12a30c))

## [0.18.4](https://github.com/chrisbenincasa/tunarr/compare/v0.18.3...v0.18.4) (2025-01-24)


### Bug Fixes

* fix bad binding causing jellyfin stream injection failure ([009f55a](https://github.com/chrisbenincasa/tunarr/commit/009f55ac84a1bec300272128ca76eb9b5b9b3917))

## [0.18.3](https://github.com/chrisbenincasa/tunarr/compare/v0.18.2...v0.18.3) (2025-01-23)


### Bug Fixes

* fix XMLTV to display show/artist title and not season/album ([45455e2](https://github.com/chrisbenincasa/tunarr/commit/45455e2a0abfe34460e78f651b8db26b493c43e3))
* fixes to displaying program title after [#910](https://github.com/chrisbenincasa/tunarr/issues/910) ([c1e673d](https://github.com/chrisbenincasa/tunarr/commit/c1e673d5130f60d3e61e74d730750f9c8931fba0))
* more flexible positioning of alphanumeric filtering ([3ab34d4](https://github.com/chrisbenincasa/tunarr/commit/3ab34d4c6d1f9449fe4def4f542490d369f87375)), closes [#1062](https://github.com/chrisbenincasa/tunarr/issues/1062)

## [0.18.2](https://github.com/chrisbenincasa/tunarr/compare/v0.18.1...v0.18.2) (2025-01-21)


### Bug Fixes

* fix tunarr.bat hardcoded node version path ([20c41f6](https://github.com/chrisbenincasa/tunarr/commit/20c41f69848a59a274700797c53f358ebcfe76a9))

## [0.18.1](https://github.com/chrisbenincasa/tunarr/compare/v0.18.0...v0.18.1) (2025-01-21)


### UI Changes

* fix betterHumanize duration function to handle &gt;=1 days with &lt;1 hours ([6c07fe2](https://github.com/chrisbenincasa/tunarr/commit/6c07fe2aced5a13a151811fb600b08e84d3b5091))

## [0.18.0](https://github.com/chrisbenincasa/tunarr/compare/v0.17.5...v0.18.0) (2025-01-19)


### Features

* add new sort order options for slot scheduling ([#1054](https://github.com/chrisbenincasa/tunarr/issues/1054)) ([d15e4e8](https://github.com/chrisbenincasa/tunarr/commit/d15e4e8847495a8e1f8392d7fdb7d85d7e455854))
* **ffmpeg:** add audio language preferences ([#1046](https://github.com/chrisbenincasa/tunarr/issues/1046)) ([f0f78eb](https://github.com/chrisbenincasa/tunarr/commit/f0f78eb84b955202609d52e3e73764b695014127)) - thanks @AugusDogus!


### Bug Fixes

* always return channels even if they have no program associations ([d41f81b](https://github.com/chrisbenincasa/tunarr/commit/d41f81b3acc074e4527eaf5c2f0575e1df53eb90))
* ensure Jellyfin password redaction works as expected ([e717cac](https://github.com/chrisbenincasa/tunarr/commit/e717cacdccb644beb4047b8e2a0d70d4f7675d3c))
* fix selecting mpeg2video as a video format ([a46cdd2](https://github.com/chrisbenincasa/tunarr/commit/a46cdd26be87fc3ad20de79f8a8a47684dd389a1))
* return filler lists in alphabetical order by name ([51647ad](https://github.com/chrisbenincasa/tunarr/commit/51647ad91bd1ba95fb49f6c3291f5074e0ea52c0))

## [0.17.5](https://github.com/chrisbenincasa/tunarr/compare/v0.17.4...v0.17.5) (2025-01-16)


### Bug Fixes

* add missing comma in ScaleQsvFilter ([f5fa38d](https://github.com/chrisbenincasa/tunarr/commit/f5fa38d12bf52b71901a56bbecafe5e7f64aca32))
* av1 decoding support on new pipeline ([#1053](https://github.com/chrisbenincasa/tunarr/issues/1053)) ([18d8363](https://github.com/chrisbenincasa/tunarr/commit/18d8363b0c4b6d054214eaf7ebbdb0bc0e4d3151))

## [0.17.4](https://github.com/chrisbenincasa/tunarr/compare/v0.17.3...v0.17.4) (2025-01-15)


### Bug Fixes

* add default value to RandomSlot#durationSpec to fix JSON DB schema migration ([c4944db](https://github.com/chrisbenincasa/tunarr/commit/c4944db8b384fb7b6237892242924f0782eaf817))
* do not backtract first 30s of a program ([3972b77](https://github.com/chrisbenincasa/tunarr/commit/3972b77728f2045c102560c1c37f5a64bfdf44cb))
* do not loop infinitely on invalid JSON schemas ([eb61d59](https://github.com/chrisbenincasa/tunarr/commit/eb61d59ed5b3d3b505608976f6eab2152115ed45))
* use hardware pixel format before vpp_qsv filter ([bbe6cd9](https://github.com/chrisbenincasa/tunarr/commit/bbe6cd9f79000ee1208af097bf7a33e7d129f9fe))


### UI Changes

* add "copy channel id to clipboard" button on channels table ([16b6cfb](https://github.com/chrisbenincasa/tunarr/commit/16b6cfb59c8488f4cadf724c343d7d27b89c8046))

## [0.17.3](https://github.com/chrisbenincasa/tunarr/compare/v0.17.2...v0.17.3) (2025-01-13)


### Bug Fixes

* fix audio + album cover streaming in new ffmpeg pipeline ([0c32d99](https://github.com/chrisbenincasa/tunarr/commit/0c32d9941ad866a430d638ff105643729caecbcc))
* fix audio + album cover streaming in new ffmpeg pipeline ([#1048](https://github.com/chrisbenincasa/tunarr/issues/1048)) ([0c32d99](https://github.com/chrisbenincasa/tunarr/commit/0c32d9941ad866a430d638ff105643729caecbcc))
* minor fixes for hls direct stream mode - still not very smooth ([0c32d99](https://github.com/chrisbenincasa/tunarr/commit/0c32d9941ad866a430d638ff105643729caecbcc))
* properly apply next state from decoder in qsv pipeline ([3a8a8e7](https://github.com/chrisbenincasa/tunarr/commit/3a8a8e7690ceb766d5d74a9313176ba82404bf71))

## [0.17.2](https://github.com/chrisbenincasa/tunarr/compare/v0.17.1...v0.17.2) (2025-01-11)


### Bug Fixes

* always specify an encoder in QSV pipeline ([f964ce1](https://github.com/chrisbenincasa/tunarr/commit/f964ce1fa2dbeff283272c94061a8b58f92f4f91))
* check for windows sooner when checking qsv/vaapi capabilities ([d973630](https://github.com/chrisbenincasa/tunarr/commit/d9736305e701932e95cbd84b9c06f704011e2195))
* fix m3u/xml copy to clipboard urls...again ([f166552](https://github.com/chrisbenincasa/tunarr/commit/f166552c02ac4796b782a8c43f86682a60361b34))
* remove erroneous channel transcode overrides ([235d3e9](https://github.com/chrisbenincasa/tunarr/commit/235d3e96b6ca9df9940aeac983569e27e2ff5e4e))
* show redirect programming properly in xmltv ([16eff87](https://github.com/chrisbenincasa/tunarr/commit/16eff8788777a1c0cde0d9ad3260dcab0e18b2c3))

## [0.17.1](https://github.com/chrisbenincasa/tunarr/compare/v0.17.0...v0.17.1) (2025-01-10)


### Bug Fixes

* add "new" button for transcode configs ([f7bca67](https://github.com/chrisbenincasa/tunarr/commit/f7bca67df5a222f5fecc5cbd63693ee747bc6df9))
* enable watermarks on new qsv ffmpeg pipeline ([0260abc](https://github.com/chrisbenincasa/tunarr/commit/0260abc555f6761deb20f3b86e440bc4e1506ef1))
* handle 10-bit hevc in new qsv pipeline + other fixes ([0260abc](https://github.com/chrisbenincasa/tunarr/commit/0260abc555f6761deb20f3b86e440bc4e1506ef1))
* use transcode configs where appropriate in new pipeline ([0260abc](https://github.com/chrisbenincasa/tunarr/commit/0260abc555f6761deb20f3b86e440bc4e1506ef1))

## [0.17.0](https://github.com/chrisbenincasa/tunarr/compare/v0.16.13...v0.17.0) (2025-01-10)


### Features

* add "transcode configurations" ([#1001](https://github.com/chrisbenincasa/tunarr/issues/1001)) ([b5a4fdf](https://github.com/chrisbenincasa/tunarr/commit/b5a4fdf9bbd2e96249b3d93552a394ded1a1eb48))
* implement existing program tools using random slots ([#1041](https://github.com/chrisbenincasa/tunarr/issues/1041)) ([00fa4d4](https://github.com/chrisbenincasa/tunarr/commit/00fa4d4f57bc69e7643f460b31eae76e6635af18))
* improvements to random slot weighting ([#1040](https://github.com/chrisbenincasa/tunarr/issues/1040)) ([4e7740b](https://github.com/chrisbenincasa/tunarr/commit/4e7740b55833224dd912bb2d34d198df18a9fe92))
* re-implement random slot UI to match time slot UI ([#1036](https://github.com/chrisbenincasa/tunarr/issues/1036)) ([8027f99](https://github.com/chrisbenincasa/tunarr/commit/8027f998db9d6320ca399bbe8b02c10b56ab5912))
* support for toggling between 12/24-hour time in UI ([#1026](https://github.com/chrisbenincasa/tunarr/issues/1026)) ([891ed29](https://github.com/chrisbenincasa/tunarr/commit/891ed296fb4794ba4ab164850bcf3c70c8f93825))
* support HLS direct channel stream mode ([#1029](https://github.com/chrisbenincasa/tunarr/issues/1029)) ([303964b](https://github.com/chrisbenincasa/tunarr/commit/303964bfe3c13aa5f060c8ca1552d68ddd9991fb))


### Bug Fixes

* additional fix for square pixel calculation ([df369f3](https://github.com/chrisbenincasa/tunarr/commit/df369f3767fc53efadc602c7e69c69f4c1be2ff3))
* allow navigation to add more programs when there are unsaved programs ([b7d05df](https://github.com/chrisbenincasa/tunarr/commit/b7d05df495a8472e4786ead5ca12906e62dff82d))
* allow setting channel stream mode on initial creation ([2f39648](https://github.com/chrisbenincasa/tunarr/commit/2f39648a5a0ee241ab79aa3d370c410d0417caed))
* always ensure a default transcode config exists via fixer ([67d1acf](https://github.com/chrisbenincasa/tunarr/commit/67d1acf456a0c523de45cfb9d4cdc6bd9c84fac4))
* choose default/selected audio streams first ([732e81d](https://github.com/chrisbenincasa/tunarr/commit/732e81d28657d6e433402efb42db5d7a5d84e4bb))
* copy full m3u url instead of just path (if backendUri is empty) ([de5cd1d](https://github.com/chrisbenincasa/tunarr/commit/de5cd1d9c52644f2b8b01d2da11cff4ffb8d5f24))
* cyclic shuffle now works with custom programs ([1a106a4](https://github.com/chrisbenincasa/tunarr/commit/1a106a4f0c3c0fa1b39b6fb8c94e32dc6b933a89))
* default new channel start time to now ([13db6ec](https://github.com/chrisbenincasa/tunarr/commit/13db6ec83cb263a0cf0e5f0dca31933aa78840f1))
* determine isAnamorphic via DAR/SAR; better square pixel size calculations ([d3dd7e4](https://github.com/chrisbenincasa/tunarr/commit/d3dd7e4f7fb83a8bd8356e678c47a32c5e16ca84))
* do not count initializing sessions in stale check ([ca0ec6a](https://github.com/chrisbenincasa/tunarr/commit/ca0ec6a92b002b7f0e43e36bc6fbb3ab38d81f35))
* do not set channel start time when saving lineups ([#1042](https://github.com/chrisbenincasa/tunarr/issues/1042)) ([4c96a24](https://github.com/chrisbenincasa/tunarr/commit/4c96a2492fe03cc47b592fc839749ce32947a437)), closes [#276](https://github.com/chrisbenincasa/tunarr/issues/276)
* fix default audio stream sort for boolean ([b298be3](https://github.com/chrisbenincasa/tunarr/commit/b298be3b6e963a225f79b0b8cd4a26fc6e714436))
* fix HLS direct mode when requested from an mpeg-ts wrapper stream ([27ab7a8](https://github.com/chrisbenincasa/tunarr/commit/27ab7a871a5ebda0499deb6d8016a59877eecf32))
* fix Jellyfin HLS direct streams ([84a8e63](https://github.com/chrisbenincasa/tunarr/commit/84a8e6346bb88ead0dd2aa1ed474f0640c1e1e04))
* fix JF streams + local watermark file inputs on legacy ffmpeg pipeline ([c6d07c8](https://github.com/chrisbenincasa/tunarr/commit/c6d07c88a48c726de282645511208565ade63e35))
* fix show sorting in cyclic shuffle ([9122018](https://github.com/chrisbenincasa/tunarr/commit/9122018c27c16ab9f3e1a913b83dc8b80efdd115))
* further delineate between selected and default audio streams for plex ([43f9ffc](https://github.com/chrisbenincasa/tunarr/commit/43f9ffc7285e4cae5d6f397f50996a9ce578d5b7))
* pick random start position for each group in cyclic shuffle ([e2d6c03](https://github.com/chrisbenincasa/tunarr/commit/e2d6c03d33bc8d5abc562072303a06a3ae0fc334))
* set correct output pad size state in ScaleFilter ([dea698c](https://github.com/chrisbenincasa/tunarr/commit/dea698c5d953c8b3ec2a6fc3b4b474735045c6be))
* use stream.selected over stream.default for plex audio streams ([1a8afb6](https://github.com/chrisbenincasa/tunarr/commit/1a8afb63edf7fffd4a4d71f66c16d02cf8e2f2b7))


### UI Changes

* move channel table actions column to first ([dedb6e4](https://github.com/chrisbenincasa/tunarr/commit/dedb6e441cd00427e899aea3da218a4b5a7f79c3))

## [0.16.13](https://github.com/chrisbenincasa/tunarr/compare/v0.16.12...v0.16.13) (2024-12-18)


### Bug Fixes

* display Plex playlists as its own library ([#1018](https://github.com/chrisbenincasa/tunarr/issues/1018)) ([22849e9](https://github.com/chrisbenincasa/tunarr/commit/22849e972bb8d6a97ba5714112f98da152c30812))
* fix issue where random slot do-not-pad could generate 0-duration flex programs ([8abd3c8](https://github.com/chrisbenincasa/tunarr/commit/8abd3c83d9efbb1d4ceef47a3a7ee4195ba4c8d1))
* improvements in handling fractional durations in scheduler ([9f46d11](https://github.com/chrisbenincasa/tunarr/commit/9f46d115fc12d45519f96d9becc7e99d029970e6))

## [0.16.12](https://github.com/chrisbenincasa/tunarr/compare/v0.16.11...v0.16.12) (2024-12-13)


### Bug Fixes

* fix channel_programs update query in updateLineup ([ea73a5d](https://github.com/chrisbenincasa/tunarr/commit/ea73a5d95c2cdbeeb687444dab145228dc238252))
* fix ProgramGroupingMinter to correctly assign type season for seasons instead of show ([0b92fa3](https://github.com/chrisbenincasa/tunarr/commit/0b92fa3de704d6fe34636f8db3d62c0bb35bd8ae))
* re-enable fixers ([3fab90f](https://github.com/chrisbenincasa/tunarr/commit/3fab90fb9a7682d9654cbc049abd5017db1c58b6))
* request additional jellyfin user view types by default ([a4cb229](https://github.com/chrisbenincasa/tunarr/commit/a4cb2299a9725c8a191f7dcfcaae69ad83828197))
* time slots - always use the currently saved lineup state for slot generation ([04e58b6](https://github.com/chrisbenincasa/tunarr/commit/04e58b6d2cd369a8f7eb261d0b92d7e02341be9c))

## [0.16.11](https://github.com/chrisbenincasa/tunarr/compare/v0.16.10...v0.16.11) (2024-12-11)


### Bug Fixes

* more fixes for per-channel guide generation + redirect calculation ([#1013](https://github.com/chrisbenincasa/tunarr/issues/1013)) ([1eff0dd](https://github.com/chrisbenincasa/tunarr/commit/1eff0ddfa54afabb95b2363a77d217b2794163d1))

## [0.16.10](https://github.com/chrisbenincasa/tunarr/compare/v0.16.9...v0.16.10) (2024-12-10)


### Bug Fixes

* alphanumeric title filter should scroll with you ([e5d10d0](https://github.com/chrisbenincasa/tunarr/commit/e5d10d07758b31614a4de056505ec9a30f3f10d4))
* properly handle redirects in scheduler ([#1011](https://github.com/chrisbenincasa/tunarr/issues/1011)) ([e5d10d0](https://github.com/chrisbenincasa/tunarr/commit/e5d10d07758b31614a4de056505ec9a30f3f10d4)), closes [#1010](https://github.com/chrisbenincasa/tunarr/issues/1010)
* use correct pixel formats when downloading from hardware ([#1008](https://github.com/chrisbenincasa/tunarr/issues/1008)) ([828367c](https://github.com/chrisbenincasa/tunarr/commit/828367c08a0e8bfe6b9d62452123d1f4e1d0a22d))

## [0.16.9](https://github.com/chrisbenincasa/tunarr/compare/v0.16.8...v0.16.9) (2024-12-06)


### Bug Fixes

* fix for plex channel auto-mapping update ([3e48d6f](https://github.com/chrisbenincasa/tunarr/commit/3e48d6ffa8b36174b6f26f383174f6e5eafcd898))
* fix form state resetting in media source edit modals ([236d819](https://github.com/chrisbenincasa/tunarr/commit/236d819d0b5148bcab97e1925d7d15116c9ce4a3))
* properly treat yuv420p10le as 10-bit ([f266fab](https://github.com/chrisbenincasa/tunarr/commit/f266fab2a43feb0e91fd43166cc9524e6a9c4b38)), closes [#1003](https://github.com/chrisbenincasa/tunarr/issues/1003)

## [0.16.8](https://github.com/chrisbenincasa/tunarr/compare/v0.16.7...v0.16.8) (2024-12-05)


### Bug Fixes

* attempt to use default audio stream before others ([aeee37b](https://github.com/chrisbenincasa/tunarr/commit/aeee37b488df99a953afbd7df632fa79cedd0aff))
* fix display names in some clients ([518d280](https://github.com/chrisbenincasa/tunarr/commit/518d2800e0f89a7e1f7cd02257eed66e2da86b99))
* fixes for CUDA pipeline state management ([#998](https://github.com/chrisbenincasa/tunarr/issues/998)) ([bbb9f76](https://github.com/chrisbenincasa/tunarr/commit/bbb9f76f99964d908bc2d3ef56b862935750aadf))
* implement "slot pad" mode in random slots ([#1000](https://github.com/chrisbenincasa/tunarr/issues/1000)) ([ec8b943](https://github.com/chrisbenincasa/tunarr/commit/ec8b9433a4a692da46d26440987ddc396e75d178))

## [0.16.7](https://github.com/chrisbenincasa/tunarr/compare/v0.16.6...v0.16.7) (2024-12-02)


### Bug Fixes

* add missing comma after setsar in ScaleVaapiFilter ([3df4300](https://github.com/chrisbenincasa/tunarr/commit/3df43005bc78e5a9745a6241648748073d1e2754))
* allow choosing channel redirects in time slots, regardless of current lineup ([f6a127a](https://github.com/chrisbenincasa/tunarr/commit/f6a127a3c1d1d5d8e69b9dcbc896dd4f73f0dd02))
* do not use default value for useNewPipeline query param in APIs ([e086ef4](https://github.com/chrisbenincasa/tunarr/commit/e086ef47edeae72f0b1c01b32915fdd24e06b088))
* fix start time / pad precision for random slots ([d4fa0af](https://github.com/chrisbenincasa/tunarr/commit/d4fa0af117974e41bd0aa07ec74bfe070582cdd6))
* implement intermittent watermarks in nvidia/vaapi ffmpeg pipelines ([97123b9](https://github.com/chrisbenincasa/tunarr/commit/97123b96bf8a0d6a865f4be9f88cef40f5d67a9d))
* infinite scroll on list view ([#994](https://github.com/chrisbenincasa/tunarr/issues/994)) ([85666c6](https://github.com/chrisbenincasa/tunarr/commit/85666c6263f15cb0fd786f2afaa1dbd75dccb442))
* properly parse .env file in bundle script for edge builds ([39e9d68](https://github.com/chrisbenincasa/tunarr/commit/39e9d6881d0c7dc8afe661848be9148d14bcfe7c))
* redirect time slots now take up the whole slot duration ([38c03fc](https://github.com/chrisbenincasa/tunarr/commit/38c03fc7cdf6746c42cb4912e74c1335a823c86c))
* set correct frame data location in HardwareDownloadFilter nextState ([05fb6f2](https://github.com/chrisbenincasa/tunarr/commit/05fb6f287345e62abfa09e8a69f092a6790af267))

## [0.16.6](https://github.com/chrisbenincasa/tunarr/compare/v0.16.5...v0.16.6) (2024-11-24)


### Bug Fixes

* disable speed-dial when loading ([#984](https://github.com/chrisbenincasa/tunarr/issues/984)) ([b10925d](https://github.com/chrisbenincasa/tunarr/commit/b10925dd93ccb479e057fcf6b9be435fa6d7130b))
* fix weekly timeslot scheduling ([#992](https://github.com/chrisbenincasa/tunarr/issues/992)) ([3597546](https://github.com/chrisbenincasa/tunarr/commit/35975467377ad20d1521873bd40bd48b82da756f))
* use stable ID when reporting Plex playback session status ([#993](https://github.com/chrisbenincasa/tunarr/issues/993)) ([b89dde9](https://github.com/chrisbenincasa/tunarr/commit/b89dde98c55e8d854aa42d3be9170c7d9e74a26b)), closes [#960](https://github.com/chrisbenincasa/tunarr/issues/960)

## [0.16.5](https://github.com/chrisbenincasa/tunarr/compare/v0.16.4...v0.16.5) (2024-11-23)


### Bug Fixes

* fix displaying weekly slot start times after save ([67593ef](https://github.com/chrisbenincasa/tunarr/commit/67593ef6b5c3629fdf9c17b02ef7ace86b16f1cb))
* prevent multiple select alls duplicating selections ([#986](https://github.com/chrisbenincasa/tunarr/issues/986)) ([f3e0f2d](https://github.com/chrisbenincasa/tunarr/commit/f3e0f2d59d214b14f3a486f388e8e503e2f84b68))
* support more watermark options on new ffmpeg pipeline ([#989](https://github.com/chrisbenincasa/tunarr/issues/989)) ([12270ba](https://github.com/chrisbenincasa/tunarr/commit/12270bab3196c47e3d15963889af147c1edc9f5e))
* update language to make Name required when adding jellyfin server ([#985](https://github.com/chrisbenincasa/tunarr/issues/985)) ([433c6e3](https://github.com/chrisbenincasa/tunarr/commit/433c6e373ec8314bca32f229ee420575dec938eb))

## [0.16.4](https://github.com/chrisbenincasa/tunarr/compare/v0.16.3...v0.16.4) (2024-11-22)


### Bug Fixes

* copy image uploads instead of rename, because we cant be sure of fs layout ([8af83e7](https://github.com/chrisbenincasa/tunarr/commit/8af83e7ae6f210f950cca4ca1e5fc64de1093d9b))
* pass correct pix_fmt to scale_cuda filter ([#980](https://github.com/chrisbenincasa/tunarr/issues/980)) ([d6448e2](https://github.com/chrisbenincasa/tunarr/commit/d6448e24a948ddf95a484c6ae8d0bdb4b05a8606))

## [0.16.3](https://github.com/chrisbenincasa/tunarr/compare/v0.16.2...v0.16.3) (2024-11-21)


### Bug Fixes

* allow backdating channel start times ([#979](https://github.com/chrisbenincasa/tunarr/issues/979)) ([4d85e08](https://github.com/chrisbenincasa/tunarr/commit/4d85e08c4a8cb968824c308af41801b179aa4710))
* fix HLS concat on new FFmpeg pipeline ([#976](https://github.com/chrisbenincasa/tunarr/issues/976)) ([e2c9b51](https://github.com/chrisbenincasa/tunarr/commit/e2c9b51ee3a7f2c9e53e07a0fdb0f98978d92377)), closes [#974](https://github.com/chrisbenincasa/tunarr/issues/974)
* slot time no longer resets day of week for weekly schedules ([f2000fb](https://github.com/chrisbenincasa/tunarr/commit/f2000fb6e7c268d0953f8069d7a149eaaeb0ece5))
* use form field array index and not table index for slot editing ([dfaab86](https://github.com/chrisbenincasa/tunarr/commit/dfaab86769a983369813f0aaa063d869cf5b8cf9))

## [0.16.2](https://github.com/chrisbenincasa/tunarr/compare/v0.16.1...v0.16.2) (2024-11-19)


### chore

* release 0.16.2 ([66552b6](https://github.com/chrisbenincasa/tunarr/commit/66552b63ef87b55172826210b35843e5c6c32661))

## [0.16.1](https://github.com/chrisbenincasa/tunarr/compare/v0.16.0...v0.16.1) (2024-11-19)


### Bug Fixes

* fix typo in kyseley-ported custom_show_content migration code ([49d8b4c](https://github.com/chrisbenincasa/tunarr/commit/49d8b4cff796d6e9e2f471d229d3e5d3705841ce))
* fix weekly time slot editing and display ([#970](https://github.com/chrisbenincasa/tunarr/issues/970)) ([9280a7c](https://github.com/chrisbenincasa/tunarr/commit/9280a7c978e35513532dc798d2ff53babac05d1d))


### UI Changes

* support perfect grid fetches in jellyfin ([#966](https://github.com/chrisbenincasa/tunarr/issues/966)) ([cf149bc](https://github.com/chrisbenincasa/tunarr/commit/cf149bc9032a7b181ea27017bd51900e13a82480))

## [0.16.0](https://github.com/chrisbenincasa/tunarr/compare/v0.15.10...v0.16.0) (2024-11-18)


### Features

* ffmpeg pipeline builder overhaul ([#829](https://github.com/chrisbenincasa/tunarr/issues/829)) ([16220cc](https://github.com/chrisbenincasa/tunarr/commit/16220cc98d20361c87caf75ac747b159812928ce))
* time slot UI overhaul ([#964](https://github.com/chrisbenincasa/tunarr/issues/964)) ([bbae17d](https://github.com/chrisbenincasa/tunarr/commit/bbae17d116135ef0b5ff41a809f7619bb0a6a17a))


### Bug Fixes

* revert default "max days" to 365 for slots ([ba8a19b](https://github.com/chrisbenincasa/tunarr/commit/ba8a19b65affd7b4ab3e6b749b588651124b6fa7))

## [0.15.10](https://github.com/chrisbenincasa/tunarr/compare/v0.15.9...v0.15.10) (2024-11-13)


### Bug Fixes

* account for weekly schedules when setting slot start time ([5797001](https://github.com/chrisbenincasa/tunarr/commit/57970018a75a2910076f6f6bc005b585d303db6a))
* chunk program grouping updates to avoid "too many sql variables" db error ([98e7ade](https://github.com/chrisbenincasa/tunarr/commit/98e7ade9c488f761e77d7f07b2c2949d16a70a7e))
* ensure program grouping upserts stay within sql variable limits ([#961](https://github.com/chrisbenincasa/tunarr/issues/961)) ([57009a2](https://github.com/chrisbenincasa/tunarr/commit/57009a24c1c334e006092f088481c8a577253bd7))
* fix improper offsets for time slots ([167f5e0](https://github.com/chrisbenincasa/tunarr/commit/167f5e0256c798f4da4c63ce8963e72da58d2e88))
* fix pagination for jellyfin ([a8d7d33](https://github.com/chrisbenincasa/tunarr/commit/a8d7d33237317317a8755d7989cea56abd1e9f2e))

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
