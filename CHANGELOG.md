# Changelog

## [1.0.14](https://github.com/chrisbenincasa/tunarr/compare/v1.0.13...v1.0.14) (2026-01-05)


### Bug Fixes

* add missing virtual field mappings for video / audio fields ([49803be](https://github.com/chrisbenincasa/tunarr/commit/49803be7e65c29e30001d55974294eb4b998527a))
* ensure invalid release date / years do not break API schema validation ([3e0b1fc](https://github.com/chrisbenincasa/tunarr/commit/3e0b1fc9cadf2fdb5c19568fb554ea9d3772630a))
* search for arch-specific meilisearch binary ([bb81409](https://github.com/chrisbenincasa/tunarr/commit/bb81409493f3e929d60c354ef4b5fe280b184895)), closes [#1561](https://github.com/chrisbenincasa/tunarr/issues/1561)

## [1.0.13](https://github.com/chrisbenincasa/tunarr/compare/v1.0.12...v1.0.13) (2026-01-04)


### Bug Fixes

* add missing build dependency for meilisearch install ([#1577](https://github.com/chrisbenincasa/tunarr/issues/1577)) ([a6933aa](https://github.com/chrisbenincasa/tunarr/commit/a6933aaa77293b90cbabce4450990a37c8dc1ec9))
* populate subtitle language metadata from ffprobe ([#1579](https://github.com/chrisbenincasa/tunarr/issues/1579)) ([d129446](https://github.com/chrisbenincasa/tunarr/commit/d129446ce58e6e95e84a468a8b9432a30019c38e))
* use proper image URL for locally scanned libraries in EPG ([d541cc5](https://github.com/chrisbenincasa/tunarr/commit/d541cc52710d9eae1b8d092d5e8b94fe087a47df))

## [1.0.12](https://github.com/chrisbenincasa/tunarr/compare/v1.0.11...v1.0.12) (2026-01-02)


### Bug Fixes

* do not run backup task immediately on server start ([70b8974](https://github.com/chrisbenincasa/tunarr/commit/70b897483b3fa6e1f2a1ce030cb3e0388f22474d))
* fix typo in MediaSourceSettingsPage description ([#1575](https://github.com/chrisbenincasa/tunarr/issues/1575)) ([28ced48](https://github.com/chrisbenincasa/tunarr/commit/28ced48939b4d577db0ff2527712032a09e336c4))
* handle quotes in search values ([53e1cdf](https://github.com/chrisbenincasa/tunarr/commit/53e1cdfe8b23d63b5a17e54367273c562a8d0bdd)), closes [#1569](https://github.com/chrisbenincasa/tunarr/issues/1569)

## [1.0.11](https://github.com/chrisbenincasa/tunarr/compare/v1.0.10...v1.0.11) (2025-12-28)


### Bug Fixes

* properly set plot field when minting Program DAOs for movies ([bacabac](https://github.com/chrisbenincasa/tunarr/commit/bacabac99d02ab0825670d77a355d0c4e581d564))
* remove missing programs alert from slot scheduler ([9404b31](https://github.com/chrisbenincasa/tunarr/commit/9404b317178948a51834e86b3758ca194780f5ea))

## [1.0.10](https://github.com/chrisbenincasa/tunarr/compare/v1.0.9...v1.0.10) (2025-12-28)


### Bug Fixes

* make Plex scannedAt attribute optional ([18f22c5](https://github.com/chrisbenincasa/tunarr/commit/18f22c518b7d3df162e028d55f6b0e36061896ba))
* more fixes to adding unscyned Jellyfin / Emby client ([c524bad](https://github.com/chrisbenincasa/tunarr/commit/c524bad1cebc7f8aab70d98a76866e16c9c6cf53))
* properly extract episode overview for Jellyfin and Emby programs ([9f64746](https://github.com/chrisbenincasa/tunarr/commit/9f64746562c96a7d7d0196d432b56c65b5ecc3e8))
* support plot and summary fields in XMLTV ([61e30f3](https://github.com/chrisbenincasa/tunarr/commit/61e30f35e72e533ec920e2039256dfb8856671d3))

## [1.0.9](https://github.com/chrisbenincasa/tunarr/compare/v1.0.8...v1.0.9) (2025-12-22)


### Bug Fixes

* fix block shuffle ordering for all program types ([36d4603](https://github.com/chrisbenincasa/tunarr/commit/36d4603d196ef49eb68bd51c9b435c1dc5e2e963))

## [1.0.8](https://github.com/chrisbenincasa/tunarr/compare/v1.0.7...v1.0.8) (2025-12-21)


### Bug Fixes

* ensure original program lineup is used each time block shuffle is generated before saving ([19baad9](https://github.com/chrisbenincasa/tunarr/commit/19baad9981666ba2b8d032ca17900cfa6fdc1ff3))
* ensure search state is cleared when navigating to media source views ([579586f](https://github.com/chrisbenincasa/tunarr/commit/579586f66d3696845373615cfdd34ce5d82b7ebc))
* fix unsynced top-level Plex playlists view ([4f42bfb](https://github.com/chrisbenincasa/tunarr/commit/4f42bfbe0bd1733e9be0f6a0b87626372b6101a3))
* revert api client timeout back to 60s ([1c36dcc](https://github.com/chrisbenincasa/tunarr/commit/1c36dcc3a2a25e8790f388cc208580b1a2461477))
* various fixes to Emby integration and API client ([49150ab](https://github.com/chrisbenincasa/tunarr/commit/49150abbcddfd0c35c5a68e3a725d50853cba024))

## [1.0.7](https://github.com/chrisbenincasa/tunarr/compare/v1.0.6...v1.0.7) (2025-12-18)


### Bug Fixes

* allow quoted strings to contain search keywords ([359cc9f](https://github.com/chrisbenincasa/tunarr/commit/359cc9f58dd67ebe37b77ef70ab2cf04e4c13525))
* allow selection of filler tab on slot editor dialog ([a23be18](https://github.com/chrisbenincasa/tunarr/commit/a23be189bb63f80739bf7551c9341e8db67c6807))
* only sort by date; items missing date will be excluded if we try to sort on it ([5e50fbb](https://github.com/chrisbenincasa/tunarr/commit/5e50fbbb120d5c443e96d1dfcfbab0890e73e3ef))

## [1.0.6](https://github.com/chrisbenincasa/tunarr/compare/v1.0.5...v1.0.6) (2025-12-17)


### Bug Fixes

* allow choosing local programs as filler ([8a11e54](https://github.com/chrisbenincasa/tunarr/commit/8a11e542b2ac1e156a314fe724694cf252bef72d))
* explicitly sort on title for GetDocuments request ([4a92c4a](https://github.com/chrisbenincasa/tunarr/commit/4a92c4a8385fd8e0eca0d0b50dd3b9bf0ef7c701))
* fix building external thumb URLs for unsynced libraries ([5bfcf6b](https://github.com/chrisbenincasa/tunarr/commit/5bfcf6b0181cb90241ff575be3fed8dc23602570))


### UI Changes

* add smart collection page ([#1542](https://github.com/chrisbenincasa/tunarr/issues/1542)) ([528790b](https://github.com/chrisbenincasa/tunarr/commit/528790b13ccc1d75c8991510ececa878cfe9649e)), closes [#1526](https://github.com/chrisbenincasa/tunarr/issues/1526)
* ensure all icons on media source table show ([c67b861](https://github.com/chrisbenincasa/tunarr/commit/c67b8615fe335155f72594b80a983d5f3cb29f68))

## [1.0.5](https://github.com/chrisbenincasa/tunarr/compare/v1.0.4...v1.0.5) (2025-12-17)


### Bug Fixes

* disable slot editor validation check on save button ([9416c37](https://github.com/chrisbenincasa/tunarr/commit/9416c37c5d66ff8060347e0da48a9222d50fb102))
* fix several form state issues in the slot dialog ([345a6af](https://github.com/chrisbenincasa/tunarr/commit/345a6af91002cd1597bb27939e541e1e32378e1c))
* return audio stream index for all streams ([b7ab23b](https://github.com/chrisbenincasa/tunarr/commit/b7ab23b1095f686b1ad189cb78be689849eea07c))

## [1.0.4](https://github.com/chrisbenincasa/tunarr/compare/v1.0.3...v1.0.4) (2025-12-16)


### Bug Fixes

* add support for attributes in credit or director xml fields ([#1540](https://github.com/chrisbenincasa/tunarr/issues/1540)) ([677b877](https://github.com/chrisbenincasa/tunarr/commit/677b877ddd61e4a956b4ee4484e8baeca06f89a6)), closes [#1528](https://github.com/chrisbenincasa/tunarr/issues/1528)
* differntiate between persisted and ephemeral artwork in API ([c5c55e5](https://github.com/chrisbenincasa/tunarr/commit/c5c55e5704e46bd112b12b627958f0173d09d49d))
* do not erroneously reset media source when changing libraries ([9e58734](https://github.com/chrisbenincasa/tunarr/commit/9e587342fde606f866391e50c7f9217e4dc7706b))
* fix destructure of undefnied when materializing slot schedules ([6aaa43b](https://github.com/chrisbenincasa/tunarr/commit/6aaa43bbcb99268933159451bb961312a92dc662))
* generate proper order for shows in slot editors ([fbf08c4](https://github.com/chrisbenincasa/tunarr/commit/fbf08c45bbf7aec46f1992136bd4fa30a59d4b28))
* properly index studios and make them searchable ([2f043b9](https://github.com/chrisbenincasa/tunarr/commit/2f043b9948d8fb809ed02bade5cfea7650c82199))
* properly map "not in" queries to search requests after parsing ([b80659f](https://github.com/chrisbenincasa/tunarr/commit/b80659f174a3b4f9d553ea0a2d02526684ebff99))
* properly mint directors/writers for movie items ([80eb15e](https://github.com/chrisbenincasa/tunarr/commit/80eb15e840702e01ea6a13062c8d60f386cf72ef))
* select ETag explicitly from Emby ([6912b3f](https://github.com/chrisbenincasa/tunarr/commit/6912b3ff108d48eca95f4265fe8b1787fe5419c2))
* use proxied /api/metadata/external endpoint for loading non-persisted artwork ([c13e530](https://github.com/chrisbenincasa/tunarr/commit/c13e530563edfd3b7aa59370a57311b4e3521078))


### Performance Improvements

* substantially improve guide building performance while reducing memory usage ([1363b88](https://github.com/chrisbenincasa/tunarr/commit/1363b88f8e20d52e38056c5f65c5bba779322aea))


### UI Changes

* hide free text info box when query string is empty ([b8b764b](https://github.com/chrisbenincasa/tunarr/commit/b8b764bd401b6c638adf5cbf7ea7709d241c5e4b))

## [1.0.3](https://github.com/chrisbenincasa/tunarr/compare/v1.0.2...v1.0.3) (2025-12-14)


### Bug Fixes

* ensure artwork is always generated for xmltv, not just for episodes ([49e99d9](https://github.com/chrisbenincasa/tunarr/commit/49e99d9b3fc651514dcb18a7ad84aea47fad7f8c))
* properly map virtual search fields grandparent_genre and show_genre to grandparent.genres ([078cc31](https://github.com/chrisbenincasa/tunarr/commit/078cc31f637cb1c956f469fe9f112c9239129b72))

## [1.0.2](https://github.com/chrisbenincasa/tunarr/compare/v1.0.1...v1.0.2) (2025-12-13)


### Bug Fixes

* allow playing local program streams that have no subtitle streams ([6dc2adc](https://github.com/chrisbenincasa/tunarr/commit/6dc2adc455238b29f9a3ca6d132f746b7a01580e))
* fix video_(height|width) virtual field mappings ([4f38e37](https://github.com/chrisbenincasa/tunarr/commit/4f38e3790bc5ac2efa83cb5fe51c3e6f5aab9298))
* remove duplicate shuffle entry in smart collection slot editor dialog ([b77f871](https://github.com/chrisbenincasa/tunarr/commit/b77f871d6552c3e59f4e086bd9e10c00b625b400))


### UI Changes

* fix typo in Slot editor ([821c9f1](https://github.com/chrisbenincasa/tunarr/commit/821c9f1171918b6810fe55d62e8517a044ec833c))

## [1.0.1](https://github.com/chrisbenincasa/tunarr/compare/v1.0.0...v1.0.1) (2025-12-12)


### Bug Fixes

* only use thumbnail paths directly if they are http/https ([3e3a89c](https://github.com/chrisbenincasa/tunarr/commit/3e3a89c8ab2a2f57d7d8c7a8dff7b90d27a02881))

## [1.0.0](https://github.com/chrisbenincasa/tunarr/compare/v0.22.18...v1.0.0) (2025-12-12)

### ⚠ BREAKING CHANGES

* persist cast/crew and their artwork to the DB ([#1448](https://github.com/chrisbenincasa/tunarr/issues/1448))
* introduce smart collections ([#1436](https://github.com/chrisbenincasa/tunarr/issues/1436))
* implement local media libraries ([#1406](https://github.com/chrisbenincasa/tunarr/issues/1406))

### Features

* media library scanner + full library search ([4dd117c](https://github.com/chrisbenincasa/tunarr/commit/4dd117cb694950ffe125c8c65d53d6fb01dc2bac))
* add parent directory as tag for other video libraries ([7d6890f](https://github.com/chrisbenincasa/tunarr/commit/7d6890f1255ba6b29dfccb0734af051ad8ebddf2))
* support negation of IN queries ([63f23ac](https://github.com/chrisbenincasa/tunarr/commit/63f23acbba4fe62198859f6cba532ab95471574b)), closes [#1514](https://github.com/chrisbenincasa/tunarr/issues/1514)
* add credits API and use it for credit thumbs ([758fd64](https://github.com/chrisbenincasa/tunarr/commit/758fd642dbb5f3681af0c4846c77dd9873870e08))
* new program page ([fde72a4](https://github.com/chrisbenincasa/tunarr/commit/fde72a49b29e8318d2463e766411165c779429b6))
* implement emptying trash functionality ([#1484](https://github.com/chrisbenincasa/tunarr/issues/1484)) ([a6360b0](https://github.com/chrisbenincasa/tunarr/commit/a6360b0b22bcc0d62bfa5635fd7610c84dbaa304))
* implement missing/trashed items ([#1481](https://github.com/chrisbenincasa/tunarr/issues/1481)) ([18cdbcb](https://github.com/chrisbenincasa/tunarr/commit/18cdbcb57de6cffaee3f53630c5df14d6557d2ca))
* add search server link to status page ([9ff38ce](https://github.com/chrisbenincasa/tunarr/commit/9ff38ce35e4b6408d61c7ff04fed0aa41d8d7ff0))
* allow manually purging dangling documents from search index ([2ddf07e](https://github.com/chrisbenincasa/tunarr/commit/2ddf07edc1c5a75460114e57d469d2b0452fd692))
* search parser overhaul ([fa6db00](https://github.com/chrisbenincasa/tunarr/commit/fa6db00f27c57ea0bfa7b1196b1d1fee1503d06d))
* add local media scanner for "other video" library type ([#1474](https://github.com/chrisbenincasa/tunarr/issues/1474)) ([efff4b8](https://github.com/chrisbenincasa/tunarr/commit/efff4b826e7dedfc725acbc316076eeeb1fb9ac6))
* expose max-indexing-threads advanced option for search ([0b30a62](https://github.com/chrisbenincasa/tunarr/commit/0b30a62b72898edfe5a1f9e1784bdec0234de079))
* hookup scanner cancellation and do it in graceful shutdown ([de5ca88](https://github.com/chrisbenincasa/tunarr/commit/de5ca88e59068fd9a9fe7891d2f54f2f350487ac))
* persist artwork and credits extracted from media source scanning ([#1450](https://github.com/chrisbenincasa/tunarr/issues/1450)) ([9c82432](https://github.com/chrisbenincasa/tunarr/commit/9c8243282618ac26caef4b238f836dd93488f601))
* persist cast/crew and their artwork to the DB ([#1448](https://github.com/chrisbenincasa/tunarr/issues/1448)) ([b26a0ba](https://github.com/chrisbenincasa/tunarr/commit/b26a0ba6223803952ee7fb4f30ee1504db1c8dbf))
* add basic fallback metadata extraction for local media ([45a9643](https://github.com/chrisbenincasa/tunarr/commit/45a9643909bb5e0a14289b818b3eae0030553c4d)), closes [#1428](https://github.com/chrisbenincasa/tunarr/issues/1428)
* allow scheduling shows that are not part of channel lineup ([#1440](https://github.com/chrisbenincasa/tunarr/issues/1440)) ([83bf854](https://github.com/chrisbenincasa/tunarr/commit/83bf85496b00d502e58ba39f74bc79d0ef3aef51))
* support smart collection slots in both slot editors ([#1442](https://github.com/chrisbenincasa/tunarr/issues/1442)) ([2c6ef93](https://github.com/chrisbenincasa/tunarr/commit/2c6ef93b56861f7d229470d568b86d975ad5b2a3))
* add search bar to top bar ([#1432](https://github.com/chrisbenincasa/tunarr/issues/1432)) ([de41188](https://github.com/chrisbenincasa/tunarr/commit/de41188963d31eefaf897b93d683bb0c565efd34))
* introduce smart collections ([#1436](https://github.com/chrisbenincasa/tunarr/issues/1436)) ([5183eae](https://github.com/chrisbenincasa/tunarr/commit/5183eae8e06141f58afb7b5085584ff5bb4e724d))
* adds new channel options button across pages ([#1425](https://github.com/chrisbenincasa/tunarr/issues/1425)) ([1c9c99c](https://github.com/chrisbenincasa/tunarr/commit/1c9c99cfd0123de8b67972fa314f622bc20dc1bd))
* add ability to randomly sort by whole show ([#1415](https://github.com/chrisbenincasa/tunarr/issues/1415)) ([3fc743a](https://github.com/chrisbenincasa/tunarr/commit/3fc743ab9188defb1ad29ea59689a31882d1f14a))
* allow basic configuration of library scan interval ([b3af495](https://github.com/chrisbenincasa/tunarr/commit/b3af495cfa01aa3f6de6a62f77da36b4247fe44d))
* allow configuring path replacements per-server ([#1412](https://github.com/chrisbenincasa/tunarr/issues/1412)) ([8a0b8b8](https://github.com/chrisbenincasa/tunarr/commit/8a0b8b831ea9b7c7f42a7764c18919ee521947e2))
* implement local media libraries ([#1406](https://github.com/chrisbenincasa/tunarr/issues/1406)) ([a748408](https://github.com/chrisbenincasa/tunarr/commit/a748408fcc5f727f88dc9ea836a2f5ecba7f3aa8))
* save program media versions to DB ([#1379](https://github.com/chrisbenincasa/tunarr/issues/1379)) ([b7b9d91](https://github.com/chrisbenincasa/tunarr/commit/b7b9d914c2c94cdb49dc6dbb200d41db960f3bfc))
* support for syncing / scanning Other Video libraries in Plex/Jellyfin ([1ea6e8a](https://github.com/chrisbenincasa/tunarr/commit/1ea6e8a1970a8ead827579550748532306fea41b))


### Bug Fixes

* allow parsing virtual show_* fields in search ([0dcd7d7](https://github.com/chrisbenincasa/tunarr/commit/0dcd7d7d6d4b2c5d35109e38381c6974d8cdffeb))
* allow using non-synced sources in filler / custom-shows ([6b27a07](https://github.com/chrisbenincasa/tunarr/commit/6b27a070c473d08862f18d07067bef4398c3f697))
* another fix for foreign keys migration; defer checking ([9d8ff9c](https://github.com/chrisbenincasa/tunarr/commit/9d8ff9c6fcadb3c46ed7a268740cad7102a53891))
* backfill program_grouping.media_source_id in fixer ([f049a81](https://github.com/chrisbenincasa/tunarr/commit/f049a81204f24fb77fae9850a9d609ca32aac26a))
* do not mark missing items in local scanners when using pathFilter ([d4ed522](https://github.com/chrisbenincasa/tunarr/commit/d4ed522aec5fe6e417db07070bcaa3cf36113cd2))
* fix mediaSourceDB#setMediaSourceUserInfo early exit clause ([71ef775](https://github.com/chrisbenincasa/tunarr/commit/71ef775cdbc5738b97edc77c9262eed3a9028b49))
* fix migration splitting for broken migration ([bcd72d7](https://github.com/chrisbenincasa/tunarr/commit/bcd72d71548baab2616ece9e1f2bc64766113171))
* handle different language formats when parsing subtitle filenames ([#1507](https://github.com/chrisbenincasa/tunarr/issues/1507)) ([b88fb47](https://github.com/chrisbenincasa/tunarr/commit/b88fb47c878dbc9e9065a6855f9e1efddde388db))
* properly display thumbnails for non-synced sources ([d1e66c5](https://github.com/chrisbenincasa/tunarr/commit/d1e66c5fe41729334f2ab018c7bc5a05b81ed9dd))
* ensure search index snapshots are included in backups ([af63a41](https://github.com/chrisbenincasa/tunarr/commit/af63a41467e85c5bd31b2025a9a4c149ff814099))
* ensure UI cannot unset 12/24 hour clock ([49fa52b](https://github.com/chrisbenincasa/tunarr/commit/49fa52b30c484ce79748e4c097c38d5ff40e49e1)), closes [#1504](https://github.com/chrisbenincasa/tunarr/issues/1504)
* only keep the last 3 DB copy migration backup files ([a61de3b](https://github.com/chrisbenincasa/tunarr/commit/a61de3b881cac61db6c04fc7f952652f5bc2d47d))
* properly materialize smart collections with structured filters when scheudling slots ([58b71a6](https://github.com/chrisbenincasa/tunarr/commit/58b71a6a133c8be55fb6bdc178b441a2014ea22f))
* simplify database copy migrations ([9804863](https://github.com/chrisbenincasa/tunarr/commit/98048634546918364d42872bb5d4f272bb9ffc01))
* take search index snapshot during backup task ([a3e885c](https://github.com/chrisbenincasa/tunarr/commit/a3e885c67eafd47f16336539d10913eaab5d6a61))
* fix missing item checking for local scanners ([ecfb621](https://github.com/chrisbenincasa/tunarr/commit/ecfb621b715b6a521cf290547f538d47b3bf6bf4))
* standardize on artwork hooks on new program detail pages ([2d0c112](https://github.com/chrisbenincasa/tunarr/commit/2d0c1121e09b20e9b22f1a06bd3999d587b9e8b5))
* actually delete smart collections when requested ([e285655](https://github.com/chrisbenincasa/tunarr/commit/e285655daf592bc4e13e4b6bacc2e8d68e094c5a))
* allow viewing slot schedulers even with missing programming ([7993bb5](https://github.com/chrisbenincasa/tunarr/commit/7993bb53c29d13b83b30169776698b837c7364c4))
* fix horizontal page scroll ([#1497](https://github.com/chrisbenincasa/tunarr/issues/1497)) ([308bf3d](https://github.com/chrisbenincasa/tunarr/commit/308bf3d5013364d0b173664ae0f45323978255d6))
* lift 1k document restriction on structured queries ([28279e8](https://github.com/chrisbenincasa/tunarr/commit/28279e8fd8e1a326f835578efb3df24670e96083))
* remove reliance on search index for program materialization ([#1494](https://github.com/chrisbenincasa/tunarr/issues/1494)) ([c5d2118](https://github.com/chrisbenincasa/tunarr/commit/c5d21187c9fe8ea3255c2bc9ba12dfd2cb3fe433))
* allow saving "free query" searches as smart collections ([d55cdd9](https://github.com/chrisbenincasa/tunarr/commit/d55cdd9e2d99cfe63247dab6a114b8565c032cf3))
* do not attempt to parse numbers from nfo files ([41f1307](https://github.com/chrisbenincasa/tunarr/commit/41f13071db93bf4c06a1a20e503062b0ad381a5a))
* fix stream duration calculation in StreamProgramCalculator ([526417b](https://github.com/chrisbenincasa/tunarr/commit/526417bd901de3c615eb89bc2aa1e65e0412f18b))
* run RefreshMediaSourceLibraries at startup; then once an hour afterwards ([ba96b3f](https://github.com/chrisbenincasa/tunarr/commit/ba96b3fac70c4029504a9cb2abd2f27b2b9e2d03))
* do not require canonicalId to return API program/grouping ([b2ea9f9](https://github.com/chrisbenincasa/tunarr/commit/b2ea9f9d969d4e8b4c4e9d239608494898d12e39))
* ensure all fields are properly updated when upserting grouping ([b06f8e4](https://github.com/chrisbenincasa/tunarr/commit/b06f8e48af4601b8e1458b01b3dec767bc9475b2))
* fix macos bundle for meilisearch ([62025c6](https://github.com/chrisbenincasa/tunarr/commit/62025c6d980bc94e84cbd1fa1d28ce9487c0f1e3))
* **ui:** fix Force Scan toolip ([434fe3b](https://github.com/chrisbenincasa/tunarr/commit/434fe3b0b67ce8b92de4ec1f24568ce9db0a876c))
* allow dumpless Meilisearch upgrades; bump to 1.27.0 ([ab82009](https://github.com/chrisbenincasa/tunarr/commit/ab820096a07e5cbff94cd2cd4f0ab33d9ce4a77a))
* improve media source scanning UI state ([dc67e9e](https://github.com/chrisbenincasa/tunarr/commit/dc67e9e047c21f8b5aff36b950207cb42dc8f631))
* make audio/subtitle language optional in nfo schemas ([18cdbcb](https://github.com/chrisbenincasa/tunarr/commit/18cdbcb57de6cffaee3f53630c5df14d6557d2ca))
* make various Plex item index fields optional ([c198860](https://github.com/chrisbenincasa/tunarr/commit/c198860f7edcb5085cb73de77108aa622ec9dff0))
* return TerminalProgram type from /channels/:id/programs ([d5405e0](https://github.com/chrisbenincasa/tunarr/commit/d5405e03ed6343515c840a1bef0ff4aed92e5126))
* add missing RemoveDanglingProgramsFromSearchTask ([96650ee](https://github.com/chrisbenincasa/tunarr/commit/96650ee0de7c08882bd8359f71ff782ea7e9afd0))
* delete items from search index when media source is deleted ([de995c7](https://github.com/chrisbenincasa/tunarr/commit/de995c7a0bfdbde5d3530a42f8e57e92c86f801f))
* ensure PlexApiClient uses dayjs from server impl ([0dc0b60](https://github.com/chrisbenincasa/tunarr/commit/0dc0b60f426ecf22b0ab47dd29a1ed0ecd3d942b))
* fix JF/Emby stream path building ([db5e6bc](https://github.com/chrisbenincasa/tunarr/commit/db5e6bcf0ce5cd54839e5362d8f5a458cbe77953))
* index additional denormalized details ([4ac97a5](https://github.com/chrisbenincasa/tunarr/commit/4ac97a5f8c738c252fcd78770e63f4f766b2cd58))
* properly persist media source path replacements on save ([2744ad0](https://github.com/chrisbenincasa/tunarr/commit/2744ad01e53c47aec3de57c5a0544b143fa85c56))
* allow query from top search bar even if not a structured query ([04cfe0c](https://github.com/chrisbenincasa/tunarr/commit/04cfe0cf420ae9235b99a7b9d7a9be0fbae621e4))
* implement proper dirty checking in media source other video scanner ([4fed159](https://github.com/chrisbenincasa/tunarr/commit/4fed159f4ca1b452e83426a8166ac909442511a2))
* include child relations for program groupings in API ([8c4634c](https://github.com/chrisbenincasa/tunarr/commit/8c4634c115b49382ea9fcfba638b130613f28d2c))
* pass relevant media source token when loading external images ([7b65ff5](https://github.com/chrisbenincasa/tunarr/commit/7b65ff5ad77ac58d057bce55e8dcdb58736299b3)), closes [#1469](https://github.com/chrisbenincasa/tunarr/issues/1469)
* proper implementation of dirty checking during media source scanning ([857f656](https://github.com/chrisbenincasa/tunarr/commit/857f6563fdffb2444f210d58d24f727cb90ff351))
* add derivedtypes update - forgot to save this file ([2f0c882](https://github.com/chrisbenincasa/tunarr/commit/2f0c882774e5accd34c91a0d92c48d75843bb26b))
* allow 0 as a track number index ([ff17084](https://github.com/chrisbenincasa/tunarr/commit/ff17084eade2d53532124f792d4812210fac8a1b)), closes [#1462](https://github.com/chrisbenincasa/tunarr/issues/1462)
* always report input on API schema parse errors ([5c20e72](https://github.com/chrisbenincasa/tunarr/commit/5c20e72a3054494a3470656751e8a9387cc1ccdf))
* catch Jellyfin VideoRangeType parse error and default to Unknown ([568594d](https://github.com/chrisbenincasa/tunarr/commit/568594df74b1f17192764a0afd4b05bd717ff177)), closes [#1452](https://github.com/chrisbenincasa/tunarr/issues/1452)
* disable dataloader caching ([95ff917](https://github.com/chrisbenincasa/tunarr/commit/95ff917ab2308d16aa580a21a63c83e77f62fc5e))
* disable music video libraries in Manage Libraries ([4f952b6](https://github.com/chrisbenincasa/tunarr/commit/4f952b64f87efbbad7ff066ccaf39f06b5cf92ee))
* do not allow changing library enabled state if locked ([8d417ba](https://github.com/chrisbenincasa/tunarr/commit/8d417bae2e4cd331e27ee7c5b198eb9af3471048))
* ensure artwork for programs is minted and saved ([db5ec6a](https://github.com/chrisbenincasa/tunarr/commit/db5ec6aa061164a614b5db5cda2b2bf6d7367977))
* fix form state when switching between slot duration types ([f02fb9b](https://github.com/chrisbenincasa/tunarr/commit/f02fb9b4ba980c1a857b7a51cd15fe1b1760fbc4))
* only show supported media library types ([b348621](https://github.com/chrisbenincasa/tunarr/commit/b3486219bc95ce02430108c894a12c17feac501b))
* populate parent entity when querying getProgramGroupingById ([9ea53fb](https://github.com/chrisbenincasa/tunarr/commit/9ea53fbf80c3d50b6753083746da953883585c25))
* properly index "index" field for seasons/albums/tracks in search ([f8f1989](https://github.com/chrisbenincasa/tunarr/commit/f8f1989ff57fecbdfe917d51bc4ef2dafadc2e2a))
* properly return index for season/album groupings from API ([533971a](https://github.com/chrisbenincasa/tunarr/commit/533971afae9c7ccb89da1a758ab2944e8cf55eb4)), closes [#1463](https://github.com/chrisbenincasa/tunarr/issues/1463)
* re-implement ChannelProgramGrid on new APIs ([#1456](https://github.com/chrisbenincasa/tunarr/issues/1456)) ([86c305e](https://github.com/chrisbenincasa/tunarr/commit/86c305e2f301b909fa9fc3c25ce77cc1404ee177))
* remove Plex auto-channel updater ([effcb18](https://github.com/chrisbenincasa/tunarr/commit/effcb1835dad099392ca6ad4418c800c2f36f635))
* return all relations for program gropuings in search API ([d217d82](https://github.com/chrisbenincasa/tunarr/commit/d217d82d5d7c2fce60fd4cb69d6ac7c62963a892))
* return full parent/grandparent details from getProgramById API ([66c03b2](https://github.com/chrisbenincasa/tunarr/commit/66c03b235c001f1f7ed029ee76a3e252696ce575))
* return terminal program genres in /programs/:id endpoint ([957f0ce](https://github.com/chrisbenincasa/tunarr/commit/957f0ce2a321dde7b374cfde8279ca7b07ccf68e)), closes [#1461](https://github.com/chrisbenincasa/tunarr/issues/1461)
* revert better-sqlite update ([e0f7162](https://github.com/chrisbenincasa/tunarr/commit/e0f71627601d3d1bef0b0c4d5029dbdb865037a2))
* allow for space between season / episode numbers ([2d4be84](https://github.com/chrisbenincasa/tunarr/commit/2d4be84f7e79f6ae55accf85ce6253ff734c312e))
* fix season/episode regex regressions with fallback regex ([0ab464f](https://github.com/chrisbenincasa/tunarr/commit/0ab464fa2f5172deaaf8d280c24de3cf86a8d107))
* make actor.role optional when parsing nfo ([5633933](https://github.com/chrisbenincasa/tunarr/commit/563393304661d7e9e99aaf1a4c29d0cf683b6d30))
* parse but ignore bin_data streams in with ffprobe ([24b7fbb](https://github.com/chrisbenincasa/tunarr/commit/24b7fbb09366ec266158b1d5680e47e13fb18454))
* support parsing season/episode numbers in the form 4x03 ([84979a6](https://github.com/chrisbenincasa/tunarr/commit/84979a67312574876fb8c95ed23e911f0cc451d2))
* accept both string or number for aspect ratio in NFO files ([eba9f89](https://github.com/chrisbenincasa/tunarr/commit/eba9f89244a68530fd8c8e4cba0cb019ce42910f))
* reset local media settings dialog state on close ([6c614e8](https://github.com/chrisbenincasa/tunarr/commit/6c614e84dc141ded751292d70708e696b553fc0b))
* do not require episode nfo files to have the uniqueid field ([6342a03](https://github.com/chrisbenincasa/tunarr/commit/6342a039c37946a3f19ef7afdb91677d3e2a0bb7))
* make videodetails nfo parsing more persmissive ([c611297](https://github.com/chrisbenincasa/tunarr/commit/c6112975308bdefc7acb99c35a9add63f710e9a0))
* do not crash if there is no stream-cache to migrate ([abb708a](https://github.com/chrisbenincasa/tunarr/commit/abb708a689e39bf48ce623f1c8320d3bfcac4e53))
* make durationinseconds optional; we dont even use this field currently ([46ceea1](https://github.com/chrisbenincasa/tunarr/commit/46ceea145358b741dafd86926ddc710fba914b4f))
* fix jellyfin and emby streaming ([5bf3e84](https://github.com/chrisbenincasa/tunarr/commit/5bf3e849c964eb98c59bb99fe5807561fca14733))
* more permissive nfo parsing ([66369b9](https://github.com/chrisbenincasa/tunarr/commit/66369b9e241e76ce1a2d6f59e4b1de79b46614d5))
* remove dependency on sharp until we can figure out x-platform packaging ([f4433f6](https://github.com/chrisbenincasa/tunarr/commit/f4433f6648791f99a4f2ee327e9f851579e9d3ec))
* fix binary release and bump node to 22.20.0 ([6475f85](https://github.com/chrisbenincasa/tunarr/commit/6475f8594d696efc0a1564bd4a14d043db3d999e))
* fix adding music items for non-synced libraries ([7a1f6f0](https://github.com/chrisbenincasa/tunarr/commit/7a1f6f08219ec9a3e5492d03048e288f9a10243a))
* fix db associations with scanned audio libraries ([ea2edc5](https://github.com/chrisbenincasa/tunarr/commit/ea2edc5403769a45340050053e8548f02183e450))
* properly upsert program grouping external ids ([8462143](https://github.com/chrisbenincasa/tunarr/commit/8462143c23c2353452c546f1209d322a4f7d8877))
* fix meilisearch grabber script to accept x64/x86_64 args for mac download ([415121e](https://github.com/chrisbenincasa/tunarr/commit/415121e5962a1e7fec86f2a84a64c6a1aa227130))
* **streaming:** convert to proper pixel format before cuda upload + scale ([091e7bd](https://github.com/chrisbenincasa/tunarr/commit/091e7bd290bcc25114db6b789db9b86decebbd0d))
* **streaming:** do not apply hwdownload filter in cuda pipeline if not on hardware ([5726d6e](https://github.com/chrisbenincasa/tunarr/commit/5726d6ecf89eea051c1babf621fe89f8b6c0aad4))
* **streaming:** do not set sc_threshold to 0 for mpeg2video out ([949efda](https://github.com/chrisbenincasa/tunarr/commit/949efda0ff028a0888c3aa52e294e9ae11a6a49f))
* **streaming:** properly pass disable hw decode/encode/filter to pipeline ([70b3757](https://github.com/chrisbenincasa/tunarr/commit/70b37577fd13c2a322a1cdac81e2639a6550f225))
* **streaming:** use bitstream filter in CUDA pipeline to workaround green line ([ff61f62](https://github.com/chrisbenincasa/tunarr/commit/ff61f62286e49245bc86f21f2252feabd614bcf1)), closes [#1390](https://github.com/chrisbenincasa/tunarr/issues/1390)
* treat ffprobe format_long_name as optional ([c656d24](https://github.com/chrisbenincasa/tunarr/commit/c656d24c7ae4f1efdccb34deabb755bea7d1c01d))
* **ui:** allow viewing stream details of custom / filler programs ([af87a17](https://github.com/chrisbenincasa/tunarr/commit/af87a17b43bdc4d567a1f130d784f0c25cea5f36))
* use proper generic other_video scanning type for inject ([e44d55d](https://github.com/chrisbenincasa/tunarr/commit/e44d55d84048cbcc7e7b21161d7264f4a46627c6))
* allow querying of other/music video types in UI ([dd494fc](https://github.com/chrisbenincasa/tunarr/commit/dd494fc6836739d2f2a8f48e03374900070794df))
* fix non-synced item enumeration when adding programming ([5a8acb7](https://github.com/chrisbenincasa/tunarr/commit/5a8acb75962999d5d7812a1381062957f7dfa306))
* **search:** make various stream metadata params filterable ([f5590f4](https://github.com/chrisbenincasa/tunarr/commit/f5590f4c7a2cc07b74b9dc15bc7664638858f3bb))
* bundle and start meilisearch properly on macOS ([32d2e23](https://github.com/chrisbenincasa/tunarr/commit/32d2e2360dee3adb1dba1ea660a0289004e4e2e4))
* do not use github api to pull meilisearch releases ([169503c](https://github.com/chrisbenincasa/tunarr/commit/169503cb950932701d2527815ded3277429cfa2e))
* ensure we do not save duplicate libraries by external_id ([071be3b](https://github.com/chrisbenincasa/tunarr/commit/071be3bd197093b2581b101de8818be46e0ff6df))
* extract proper child counts for JF parent items ([1261f22](https://github.com/chrisbenincasa/tunarr/commit/1261f22cc32e443cdaa56951b4754ce79e492ab7))
* meilisearch windows build needs exe extension ([13ffcd2](https://github.com/chrisbenincasa/tunarr/commit/13ffcd2d42039017509fff8cf5128a8c7dea50f4))
* **ui:** allow switching non-synced JF/Emby libraries ([0d812ed](https://github.com/chrisbenincasa/tunarr/commit/0d812eda2cc250e81e87d84b8ef471729ac2a727))
* **ui:** properly show selection state on imported items ([fff1f6c](https://github.com/chrisbenincasa/tunarr/commit/fff1f6cb519cddde432ae79f7b5ae55313e34d4f))

### UI Changes

* add link to search page from smart collections page ([dc3e932](https://github.com/chrisbenincasa/tunarr/commit/dc3e932f5326063350e61a56ca8d6d9c5fa06f2c))
* add warning for structured vs free queries ([714982f](https://github.com/chrisbenincasa/tunarr/commit/714982f3ca95722e68273cf00f6ea838bdf6f060))
* consistent library page UX and always-visible drawer ([2c59729](https://github.com/chrisbenincasa/tunarr/commit/2c5972951b83b72eeb19d18847fd8b0f2e7dbcec))
* cleaning up some mobile styling ([#1405](https://github.com/chrisbenincasa/tunarr/issues/1405)) ([9a79146](https://github.com/chrisbenincasa/tunarr/commit/9a791467df48c44367ac6d6244d6e6932f6e0764))


## [0.22.18](https://github.com/chrisbenincasa/tunarr/compare/v0.22.17...v0.22.18) (2025-12-08)


### Bug Fixes

* fix stream duration calculation in StreamProgramCalculator ([526417b](https://github.com/chrisbenincasa/tunarr/commit/526417bd901de3c615eb89bc2aa1e65e0412f18b))
* only generate in range indexes ([bcb7542](https://github.com/chrisbenincasa/tunarr/commit/bcb7542d817144fc51e795814633ae2cf1267ed8))

## [0.22.17](https://github.com/chrisbenincasa/tunarr/compare/v0.22.16...v0.22.17) (2025-11-26)


### Bug Fixes

* properly detect non-docker/podman container environments ([f8a2a24](https://github.com/chrisbenincasa/tunarr/commit/f8a2a2464ad889d763488a5580d780e9be18da6e)), closes [#1485](https://github.com/chrisbenincasa/tunarr/issues/1485)

## [0.22.16](https://github.com/chrisbenincasa/tunarr/compare/v0.22.15...v0.22.16) (2025-11-24)


### Bug Fixes

* dynamically calculate SAR when necessary ([69c6947](https://github.com/chrisbenincasa/tunarr/commit/69c6947d081193698afb10ae5c8a1b5058c1cfbc))
* fix build with new sample aspect ratio fields ([80fccd2](https://github.com/chrisbenincasa/tunarr/commit/80fccd257a88158aff7715bead951a80a92c7a83))
* fix tests after SAR changes ([944039e](https://github.com/chrisbenincasa/tunarr/commit/944039e00e5826c8f5bba4e94662e6baf5b3010a))
* make duration_ts option on video streams in ffprobe output ([fe34da8](https://github.com/chrisbenincasa/tunarr/commit/fe34da871e5959269d99bab0879f8260e332d51d))
* **streaming:** properly set decoder thread count to 1 for hwaccel pipelines ([72f128b](https://github.com/chrisbenincasa/tunarr/commit/72f128b39132f469561773f1b5cc554d201df01c))
* **ui:** fix remaining time calculation and display in guide ([3c5ea7a](https://github.com/chrisbenincasa/tunarr/commit/3c5ea7a5780587d72375913f1f0efd0b48a3721f))

## [0.22.15](https://github.com/chrisbenincasa/tunarr/compare/v0.22.14...v0.22.15) (2025-11-16)


### Bug Fixes

* do not pass exact duration to audio pad filter ([289acf1](https://github.com/chrisbenincasa/tunarr/commit/289acf1c009da52396b440db9626f0f31df5a4d2))
* fix bad form state in channel EPG settings ([ec82018](https://github.com/chrisbenincasa/tunarr/commit/ec820188a3c50e254668818cd61c6385028be104)), closes [#1468](https://github.com/chrisbenincasa/tunarr/issues/1468)
* more balanced cyclic shuffle implementation ([0ceb5e3](https://github.com/chrisbenincasa/tunarr/commit/0ceb5e383705fc548cecea6574bb78d48494cda7))
* remove BackfillProgramGroupings fixer ([f6cf17f](https://github.com/chrisbenincasa/tunarr/commit/f6cf17f27000500b5b71a67e99318696c35436c2))

## [0.22.14](https://github.com/chrisbenincasa/tunarr/compare/v0.22.13...v0.22.14) (2025-11-10)


### Bug Fixes

* overhaul logs and system logs page ([24b3213](https://github.com/chrisbenincasa/tunarr/commit/24b32130789c0c3666eefa2dc43113db659833ce))

## [0.22.13](https://github.com/chrisbenincasa/tunarr/compare/v0.22.12...v0.22.13) (2025-11-10)


### Bug Fixes

* disable time slot editor buttong when there are no slots ([cc4f056](https://github.com/chrisbenincasa/tunarr/commit/cc4f056e559f0e6d13ec6b7fc1403dc4807b9c55))
* fix sidear ASS subtitle download in Jellyfin ([5784079](https://github.com/chrisbenincasa/tunarr/commit/578407965ce473006abbd65ea1b3c0ca0201e404)), closes [#1457](https://github.com/chrisbenincasa/tunarr/issues/1457)

## [0.22.12](https://github.com/chrisbenincasa/tunarr/compare/v0.22.11...v0.22.12) (2025-11-06)


### Bug Fixes

* fix form state when switching between slot duration types ([f02fb9b](https://github.com/chrisbenincasa/tunarr/commit/f02fb9b4ba980c1a857b7a51cd15fe1b1760fbc4))
* remove Plex auto-channel updater ([effcb18](https://github.com/chrisbenincasa/tunarr/commit/effcb1835dad099392ca6ad4418c800c2f36f635))

## [0.22.11](https://github.com/chrisbenincasa/tunarr/compare/v0.22.10...v0.22.11) (2025-10-27)


### Bug Fixes

* allow playing remote media from Emby ([8eaa68f](https://github.com/chrisbenincasa/tunarr/commit/8eaa68fe684fe909a4f06b901a54249e5dbb91e3))

## [0.22.10](https://github.com/chrisbenincasa/tunarr/compare/v0.22.9...v0.22.10) (2025-10-27)


### Bug Fixes

* fix HLS direct playback in Jellyfin for MKV/MP4 output formats ([85ea844](https://github.com/chrisbenincasa/tunarr/commit/85ea844e6a64d8f277c5e6d2ffea4ee8524cb962))
* fix lineupItemToChannelProgram override to account for undefined channel.programs ([a87cf4a](https://github.com/chrisbenincasa/tunarr/commit/a87cf4a9f848e9b2d3d15d9dba3f4fee21ba45e5))
* **streaming:** always set framerate when resetting PTS in QSV pipeline ([00c17a8](https://github.com/chrisbenincasa/tunarr/commit/00c17a8689ae04f7d91ae9085f0b9de859529676)), closes [#1431](https://github.com/chrisbenincasa/tunarr/issues/1431)
* **streaming:** fix HLS direct streaming for Jellyfin 10.11 ([81ea984](https://github.com/chrisbenincasa/tunarr/commit/81ea98410fce5f19950e86c8c601fa92fb53e4f5))
* use default analyzeduration (5s) when probing files instead of 30 microseconds ([91755b3](https://github.com/chrisbenincasa/tunarr/commit/91755b3eab8e82d8cbd5ac85dfc28560f985cf2e))

## [0.22.9](https://github.com/chrisbenincasa/tunarr/compare/v0.22.8...v0.22.9) (2025-10-18)


### Bug Fixes

* **streaming:** potential fix for QSV audio sync issues ([f5a96ae](https://github.com/chrisbenincasa/tunarr/commit/f5a96aef831b7212d5331aa24abdad885cac27c8))

## [0.22.8](https://github.com/chrisbenincasa/tunarr/compare/v0.22.7...v0.22.8) (2025-10-15)


### Bug Fixes

* do not let stream cache hard fail streams ([e5e5b15](https://github.com/chrisbenincasa/tunarr/commit/e5e5b1510660149ebd6404ba6bc87ad6b500403a))

## [0.22.7](https://github.com/chrisbenincasa/tunarr/compare/v0.22.6...v0.22.7) (2025-10-15)


### Bug Fixes

* ensure program summaries are escaped for xml ([9f3cad5](https://github.com/chrisbenincasa/tunarr/commit/9f3cad52c959864a7c4863ea1167f2ebb852fb42))
* handle some weird cases of expected exit in ffmpeg ([8106d34](https://github.com/chrisbenincasa/tunarr/commit/8106d3491affef35a95ca93e210a15d4de71f74f))
* **streaming:** apply sc_threshold after hw accel is decided ([1037ca3](https://github.com/chrisbenincasa/tunarr/commit/1037ca30ed30a30c330d447815799546582ac12b))
* **streaming:** fix audio only streams for vaapi ([c0691cc](https://github.com/chrisbenincasa/tunarr/commit/c0691ccb03dd8f5ef3fa7b4cf3c83a14d304d965)), closes [#1365](https://github.com/chrisbenincasa/tunarr/issues/1365)

## [0.22.6](https://github.com/chrisbenincasa/tunarr/compare/v0.22.5...v0.22.6) (2025-10-08)


### Bug Fixes

* add subtitle and description to xmltv ([f056790](https://github.com/chrisbenincasa/tunarr/commit/f0567902d2bb89963c8040ea3712bec72384347b))
* **streaming:** convert to proper pixel format before cuda upload + scale ([091e7bd](https://github.com/chrisbenincasa/tunarr/commit/091e7bd290bcc25114db6b789db9b86decebbd0d))
* **streaming:** do not set sc_threshold to 0 for mpeg2video out ([949efda](https://github.com/chrisbenincasa/tunarr/commit/949efda0ff028a0888c3aa52e294e9ae11a6a49f))
* **streaming:** properly pass disable hw decode/encode/filter to pipeline ([70b3757](https://github.com/chrisbenincasa/tunarr/commit/70b37577fd13c2a322a1cdac81e2639a6550f225))
* **streaming:** use bitstream filter in CUDA pipeline to workaround green line ([ff61f62](https://github.com/chrisbenincasa/tunarr/commit/ff61f62286e49245bc86f21f2252feabd614bcf1)), closes [#1390](https://github.com/chrisbenincasa/tunarr/issues/1390)
* **ui:** allow viewing stream details of custom / filler programs ([af87a17](https://github.com/chrisbenincasa/tunarr/commit/af87a17b43bdc4d567a1f130d784f0c25cea5f36))


### UI Changes

* add season/episode to Tunarr guide page ([eeb3f6d](https://github.com/chrisbenincasa/tunarr/commit/eeb3f6dcec9cc4bcc0c3179a2eabc991ce14b3c0)), closes [#1398](https://github.com/chrisbenincasa/tunarr/issues/1398)

## [0.22.5](https://github.com/chrisbenincasa/tunarr/compare/v0.22.4...v0.22.5) (2025-09-23)


### Bug Fixes

* **streaming:** do not apply hwdownload filter in cuda pipeline if not on hardware ([5726d6e](https://github.com/chrisbenincasa/tunarr/commit/5726d6ecf89eea051c1babf621fe89f8b6c0aad4))
* treat ffprobe format_long_name as optional ([c656d24](https://github.com/chrisbenincasa/tunarr/commit/c656d24c7ae4f1efdccb34deabb755bea7d1c01d))

## [0.22.4](https://github.com/chrisbenincasa/tunarr/compare/v0.22.3...v0.22.4) (2025-09-19)


### Bug Fixes

* do not send fractional millis to ffmpeg stream seek ([b588137](https://github.com/chrisbenincasa/tunarr/commit/b5881379682f436c3f590cc913217d4f9759218c)), closes [#1378](https://github.com/chrisbenincasa/tunarr/issues/1378)
* ensure PremiereDate is selected for both Jellyfin and Emby ([335c0a0](https://github.com/chrisbenincasa/tunarr/commit/335c0a069b4c2b077a67561b9fcc95bb0c84937f)), closes [#1389](https://github.com/chrisbenincasa/tunarr/issues/1389)
* **ui:** allow saving transcode config when audio format is copy ([a98bc32](https://github.com/chrisbenincasa/tunarr/commit/a98bc329cd4c9f2c32cca8a9cc656e871735fd31)), closes [#1387](https://github.com/chrisbenincasa/tunarr/issues/1387)

## [0.22.3](https://github.com/chrisbenincasa/tunarr/compare/v0.22.2...v0.22.3) (2025-09-16)


### Bug Fixes

* allow selecting parent Jellyfin items in list view ([9756e35](https://github.com/chrisbenincasa/tunarr/commit/9756e35008e36b0acb95f726bebd04f6ed706c78))
* correct set the isDefault bit on new transcode configs ([180841c](https://github.com/chrisbenincasa/tunarr/commit/180841c1b931d35e693a6bbd0886f819b318db28))
* **streaming:** change how QSV is initialized on Windows ([1dbec53](https://github.com/chrisbenincasa/tunarr/commit/1dbec5357bed545869a685b02bfa5440a3649243))
* **streaming:** do not apply apad when audio encoder is copy ([92bce8a](https://github.com/chrisbenincasa/tunarr/commit/92bce8ac2c159b3f8f20ddec9503edcd82f57558)), closes [#1311](https://github.com/chrisbenincasa/tunarr/issues/1311)
* **streaming:** fallback to yadif=1 when configured software deinterlace is none ([3a5e69d](https://github.com/chrisbenincasa/tunarr/commit/3a5e69d925468662347ac338763a695fd51ab16b))
* **ui:** add missing BackupForm file erroneously left out ([67b97b0](https://github.com/chrisbenincasa/tunarr/commit/67b97b05d97f1f20aa9ce0164a235ae13ce7f09b))
* **ui:** disable various audio stream forms when encoder is set to copy ([2aa12c3](https://github.com/chrisbenincasa/tunarr/commit/2aa12c34e514e2c5faaa927290435ed955f068b3))
* **ui:** properly handle keyboard input for backup time picker ([39a6d70](https://github.com/chrisbenincasa/tunarr/commit/39a6d70efd483c721086c5e4d9d177e12c4278a7)), closes [#1361](https://github.com/chrisbenincasa/tunarr/issues/1361)


### UI Changes

* hide missing season/associations health checks ([59265a8](https://github.com/chrisbenincasa/tunarr/commit/59265a8b2666ffbcc217b33f8daba75e4a175355))

## [0.22.2](https://github.com/chrisbenincasa/tunarr/compare/v0.22.1...v0.22.2) (2025-09-07)


### Bug Fixes

* **streaming:** always use streamDuration for duration in ffmpeg pipeline ([#1357](https://github.com/chrisbenincasa/tunarr/issues/1357)) ([9eac043](https://github.com/chrisbenincasa/tunarr/commit/9eac043d5c6d9cfff929feec0fe73e24a6ed2eda))

## [0.22.1](https://github.com/chrisbenincasa/tunarr/compare/v0.22.0...v0.22.1) (2025-09-05)


### chore

* fix docker build ([37c6708](https://github.com/chrisbenincasa/tunarr/commit/37c6708919e0331dcd23f6595075c749f013922d))
* release 0.22.1 ([cb7c0c1](https://github.com/chrisbenincasa/tunarr/commit/cb7c0c1a093a904eff8cd669c13cccc561935450))

## [0.22.0](https://github.com/chrisbenincasa/tunarr/compare/v0.22.0...v0.22.0) (2025-09-05)


### chore

* fix docker build ([37c6708](https://github.com/chrisbenincasa/tunarr/commit/37c6708919e0331dcd23f6595075c749f013922d))

## [0.22.0](https://github.com/chrisbenincasa/tunarr/compare/v0.21.11...v0.22.0) (2025-09-04)


### ⚠ BREAKING CHANGES

* expose advanced transcode parameters ([#1347](https://github.com/chrisbenincasa/tunarr/issues/1347))

### Features

* expose advanced transcode parameters ([#1347](https://github.com/chrisbenincasa/tunarr/issues/1347)) ([f13e3bb](https://github.com/chrisbenincasa/tunarr/commit/f13e3bbefb8bda8dd1dd39af83027a1e1c745643)), closes [#1090](https://github.com/chrisbenincasa/tunarr/issues/1090)
* **scheduling:** keep random ordering stable between preview/save in slots ([#1354](https://github.com/chrisbenincasa/tunarr/issues/1354)) ([afcbac9](https://github.com/chrisbenincasa/tunarr/commit/afcbac9ed43886b988992954f8135a6add25a643))


### Bug Fixes

* do not pass userId in Jellyfin library requests ([62b853d](https://github.com/chrisbenincasa/tunarr/commit/62b853d6cb775cb7931994429905a8542b7bc850))
* ensure fallback filler is looped for the duration of the stream block ([#1329](https://github.com/chrisbenincasa/tunarr/issues/1329)) ([c16b208](https://github.com/chrisbenincasa/tunarr/commit/c16b208362b23fc75ac12d93c745afa3e746f8df))
* **scheduling:** keep relevant existing values when switching program types in slot editor ([4880e42](https://github.com/chrisbenincasa/tunarr/commit/4880e42c745f36c667435652f7b888f1695c2c52)), closes [#1352](https://github.com/chrisbenincasa/tunarr/issues/1352)
* **scheduling:** properly deduplicate custom/filler programs for slot algos ([0e49c41](https://github.com/chrisbenincasa/tunarr/commit/0e49c4149cc070024026c472d1a69814dfc76057))
* several fixes to filler editor and programming ([#1350](https://github.com/chrisbenincasa/tunarr/issues/1350)) ([aba6018](https://github.com/chrisbenincasa/tunarr/commit/aba6018a3edfd962ff1e40a817b8052afefee40c))
* **ui:** ensure correct guide end time is passed for specific channel guide queries ([dd2b9a3](https://github.com/chrisbenincasa/tunarr/commit/dd2b9a350ea7e07c564670ad562b098bcae85ab5))
* **ui:** fix transcode config name overlay in summary page ([b00a68a](https://github.com/chrisbenincasa/tunarr/commit/b00a68a9705f57f7049663d8b20a1e3f67cddd4c))
* **ui:** invalidate relevant queries after transcode config is deleted ([abf3b8b](https://github.com/chrisbenincasa/tunarr/commit/abf3b8bf39966bfe34a6a1310719cca6afe44546))


### UI Changes

* fix wording for channel flex cooldown ([c135fe7](https://github.com/chrisbenincasa/tunarr/commit/c135fe7c31319d3a66542e2b9736faf34e9191ee))

## [0.21.11](https://github.com/chrisbenincasa/tunarr/compare/v0.21.10...v0.21.11) (2025-08-27)


### Bug Fixes

* **scheduling:** always use full custom show / filler list when generating slot schedule ([c3aa641](https://github.com/chrisbenincasa/tunarr/commit/c3aa6417a07dc436513a940b7f4aad8df45e99c0))
* **streaming:** fix HLS stream paths in legacy streaming pipeline ([adc1113](https://github.com/chrisbenincasa/tunarr/commit/adc1113cdc36de15d453f70d275ca2c3e68e3425))

## [0.21.10](https://github.com/chrisbenincasa/tunarr/compare/v0.21.9...v0.21.10) (2025-08-22)


### Bug Fixes

* fix channel logo upload validation (by ignoring it) ([fdfbe4a](https://github.com/chrisbenincasa/tunarr/commit/fdfbe4aa7643a4cb8c0e72e27016c614b2fbb847))


### UI Changes

* remove extra padding from mobile styles ([a7ead3a](https://github.com/chrisbenincasa/tunarr/commit/a7ead3a43df0072b183905b1b22e1febebb2fd86))

## [0.21.9](https://github.com/chrisbenincasa/tunarr/compare/v0.21.8...v0.21.9) (2025-08-22)


### chore

* release 0.21.9 ([217209f](https://github.com/chrisbenincasa/tunarr/commit/217209fcb851ca28780111d27acaccc02e49f9db))

## [0.21.8](https://github.com/chrisbenincasa/tunarr/compare/v0.21.7...v0.21.8) (2025-08-21)


### Bug Fixes

* use iso.datetime instead of iso.date for guide API ([30afcc5](https://github.com/chrisbenincasa/tunarr/commit/30afcc5633c73da1ab8079f84961dd882ea53477))

## [0.21.7](https://github.com/chrisbenincasa/tunarr/compare/v0.21.6...v0.21.7) (2025-08-20)


### Features

* **ui:** remove restrictions on "add breaks" tool ([a23df83](https://github.com/chrisbenincasa/tunarr/commit/a23df830c412e4484a150c226cd7115415665d6c)), closes [#1333](https://github.com/chrisbenincasa/tunarr/issues/1333)


### Bug Fixes

* **ui:** fix filler list weight distribution ([5fe9595](https://github.com/chrisbenincasa/tunarr/commit/5fe95958ed03ec200e74b9b863342d42951e399e)), closes [#1316](https://github.com/chrisbenincasa/tunarr/issues/1316)
* **ui:** scope select all to selected jellyfin genre ([2e77231](https://github.com/chrisbenincasa/tunarr/commit/2e772314ecea1ac0e0e0efecd73f61719dd573e7)), closes [#1332](https://github.com/chrisbenincasa/tunarr/issues/1332)


### UI Changes

* **ui:** make filler cooldown differences more clear ([d93805f](https://github.com/chrisbenincasa/tunarr/commit/d93805fee162a41fe192be5a8c06e16a542c7b71))

## [0.21.6](https://github.com/chrisbenincasa/tunarr/compare/v0.21.5...v0.21.6) (2025-08-20)


### Bug Fixes

* default stream output directory to within Tunarr data directory ([d901652](https://github.com/chrisbenincasa/tunarr/commit/d90165271e628114eb00f3cbe30ff96d9d4f083d))
* **ui:** ensure media source dialogs always update after edits ([ec213f0](https://github.com/chrisbenincasa/tunarr/commit/ec213f0e0d3bb0454e534bffe8d1734f094f07e9))

## [0.21.5](https://github.com/chrisbenincasa/tunarr/compare/v0.21.4...v0.21.5) (2025-08-16)


### Bug Fixes

* allow adding emby programs to custom shows ([912b540](https://github.com/chrisbenincasa/tunarr/commit/912b54023c0aedf09948703b2138a2731f7ac7f4))
* fix ffprobe command in stream details debug tab ([576f337](https://github.com/chrisbenincasa/tunarr/commit/576f337164676a6a37c72c35847476550994386a))
* include original ffmpeg command in error file ([cc2776b](https://github.com/chrisbenincasa/tunarr/commit/cc2776ba08726b730675b867ead96222fc0e879b))


### UI Changes

* account for delete action in program list padding ([fba8bda](https://github.com/chrisbenincasa/tunarr/commit/fba8bda4b2a6116e0bacb02994289b04d23b70bd))
* allow for larger steam detail dialogs ([ba2f767](https://github.com/chrisbenincasa/tunarr/commit/ba2f767b25665b9d51d56f490673771aa4f07f5e))
* limit size of channel logo on summary page ([1e3af1a](https://github.com/chrisbenincasa/tunarr/commit/1e3af1ab9035dc3c9902ac75dd56f7ef6a15ed7f))
* standardize channel menu ([119d280](https://github.com/chrisbenincasa/tunarr/commit/119d280712ecb4a6017d3836ad652f385479ff75))

## [0.21.4](https://github.com/chrisbenincasa/tunarr/compare/v0.21.3...v0.21.4) (2025-08-14)


### Features

* **scheduling:** allow picking filler order for per-slot filler ([#1322](https://github.com/chrisbenincasa/tunarr/issues/1322)) ([72eb2a8](https://github.com/chrisbenincasa/tunarr/commit/72eb2a8a3dbd9ac9edbccb2982ae1e0b12d65e27))


### Bug Fixes

* fix subtitle extraction ([e6ac4d4](https://github.com/chrisbenincasa/tunarr/commit/e6ac4d45c1de6686189c1016815e976f06e01d47))

## [0.21.3](https://github.com/chrisbenincasa/tunarr/compare/v0.21.2...v0.21.3) (2025-08-14)


### Bug Fixes

* fix jellyfin library selector ([#1320](https://github.com/chrisbenincasa/tunarr/issues/1320)) ([c898b3e](https://github.com/chrisbenincasa/tunarr/commit/c898b3ee9dfe6ed88b0232de9d0daca1565f1e72))
* properly init channel cache ([ec3e98e](https://github.com/chrisbenincasa/tunarr/commit/ec3e98efe51553d56d6d4ed44be7dbb1c902cf4f))
* synchronously initialize PersistentChannelCache ([838d8cc](https://github.com/chrisbenincasa/tunarr/commit/838d8cca3087cccb2d21eace73bf8b6c1a896ab4))
* **ui:** actually fix issue with changing slot type not rendering ([23be5c0](https://github.com/chrisbenincasa/tunarr/commit/23be5c03916a495fdd1671d6a8b9a559dad5f1f7))

## [0.21.2](https://github.com/chrisbenincasa/tunarr/compare/v0.21.1...v0.21.2) (2025-08-13)


### Bug Fixes

* **scheduling:** many fixes to filler types in slot editors ([#1318](https://github.com/chrisbenincasa/tunarr/issues/1318)) ([3e69e0b](https://github.com/chrisbenincasa/tunarr/commit/3e69e0bf92bb1b374df301d45ce9c29f564e6179))
* **ui:** enable submit button after changing existing slot type ([a1e59aa](https://github.com/chrisbenincasa/tunarr/commit/a1e59aade6e956c2d22f643b11c706714d4bdee8))

## [0.21.1](https://github.com/chrisbenincasa/tunarr/compare/v0.21.0...v0.21.1) (2025-08-11)


### Bug Fixes

* **jellyfin:** user /Library/VirtualFolders endpoint for gathering user libraries ([aa6c0af](https://github.com/chrisbenincasa/tunarr/commit/aa6c0af28a170afdf109e43cef79dcf5ffca2dcf))
* **ui:** propery re-render slot program form when type changes ([3d99ce6](https://github.com/chrisbenincasa/tunarr/commit/3d99ce6695fc174e3021951162e45a4d5ce5dda5))

## [0.21.0](https://github.com/chrisbenincasa/tunarr/compare/v0.20.6...v0.21.0) (2025-08-11)


### ⚠ BREAKING CHANGES

* **scheduling:** ability to schedule filler directly in slot schedulers ([#1234](https://github.com/chrisbenincasa/tunarr/issues/1234))

### Features

* add genres endpoint and integrate genre selection in the ui for… ([#1295](https://github.com/chrisbenincasa/tunarr/issues/1295)) ([50ceb54](https://github.com/chrisbenincasa/tunarr/commit/50ceb548f9d7e183de68b4055e100b891a847830))
* add movie nfo parser ([#1262](https://github.com/chrisbenincasa/tunarr/issues/1262)) ([3ba2aad](https://github.com/chrisbenincasa/tunarr/commit/3ba2aad889fa30d48795ac9eb28b2a4af7656aac))
* add program stream details info to program dialog ([#1296](https://github.com/chrisbenincasa/tunarr/issues/1296)) ([d87f269](https://github.com/chrisbenincasa/tunarr/commit/d87f2699bfa150e180815ec7d2d11c1ae018f7a7))
* add tv show and episode nfo parsers ([#1266](https://github.com/chrisbenincasa/tunarr/issues/1266)) ([555d838](https://github.com/chrisbenincasa/tunarr/commit/555d8384a75758a2ee80d3f3a48dc3a7b579f6f4))
* **macos:** add proper macOS wrapper app ([#1290](https://github.com/chrisbenincasa/tunarr/issues/1290)) ([e293f4c](https://github.com/chrisbenincasa/tunarr/commit/e293f4cf57410a92d6d065ed54518ed00d345462))
* **scheduling:** ability to schedule filler directly in slot schedulers ([#1234](https://github.com/chrisbenincasa/tunarr/issues/1234)) ([fed7717](https://github.com/chrisbenincasa/tunarr/commit/fed7717a82e5f464986d0f2ae3f50d4538c2fc54))
* **scheduling:** support for flex kinds in time slots ([#1238](https://github.com/chrisbenincasa/tunarr/issues/1238)) ([7a16eab](https://github.com/chrisbenincasa/tunarr/commit/7a16eabdcbce2e619d3f5a7e6b20ab016b4150e3))


### Bug Fixes

* allow scheduling content from mixed-type Emby libraries ([a894ef4](https://github.com/chrisbenincasa/tunarr/commit/a894ef4b56c0e56a265c9894dee8483dc0698a7d))
* ensure release action uses proper xcode version ([7c6214b](https://github.com/chrisbenincasa/tunarr/commit/7c6214b368074e5a5d2a36930f18769a1fd663cd))
* ensure remove duplicates uses most up-to-date program list ([c6d9b79](https://github.com/chrisbenincasa/tunarr/commit/c6d9b7928543663b2f4a45ba15ed974f1b07d7f7)), closes [#1297](https://github.com/chrisbenincasa/tunarr/issues/1297)
* fixes and simplification of stream program calculator ([#1301](https://github.com/chrisbenincasa/tunarr/issues/1301)) ([3fa2808](https://github.com/chrisbenincasa/tunarr/commit/3fa2808a6a5454004e113ee41a06bda76254e834))
* hide scheduled filler content from EPG by default ([#1286](https://github.com/chrisbenincasa/tunarr/issues/1286)) ([d36bfd0](https://github.com/chrisbenincasa/tunarr/commit/d36bfd0299989d09b404a6f317fac5c65c79fc61))
* only run ReconcileProgramDurationsTask when necessary ([ed09b4c](https://github.com/chrisbenincasa/tunarr/commit/ed09b4c4995e26a5e2730444a64d61c370cbde0e))
* remove admin mode ([8fa0bac](https://github.com/chrisbenincasa/tunarr/commit/8fa0bacdb5a9f0cd6a81f33edb0a1ec5307236d3))
* **streaming:** explicitly set software mpeg2video encoder ([6976e35](https://github.com/chrisbenincasa/tunarr/commit/6976e35dbf3cd18b29df35a719bd54dd2e64d943))
* **streaming:** fallback to software decode when seeking with QSV ([#1276](https://github.com/chrisbenincasa/tunarr/issues/1276)) ([e8e4bac](https://github.com/chrisbenincasa/tunarr/commit/e8e4bac0f79e76759049b460b7015fbd6025e9df))
* **streaming:** multiple fixes for image-based sub overlays on CUDA ([#1275](https://github.com/chrisbenincasa/tunarr/issues/1275)) ([bb63c46](https://github.com/chrisbenincasa/tunarr/commit/bb63c4640e69ca5c1e57b72b0786f662480b6bbb)), closes [#1272](https://github.com/chrisbenincasa/tunarr/issues/1272)
* **streaming:** only set output pixel format on CUDA hwdownload when necessary ([3f9d3ce](https://github.com/chrisbenincasa/tunarr/commit/3f9d3ce3fd3b74d3945a89911b044127b5707cd7))
* **streaming:** remove first_pts setting to fix audio drop/desync issues ([dde8a83](https://github.com/chrisbenincasa/tunarr/commit/dde8a839b5936c82d814128a139b3a58c97ff2ad))
* **streaming:** remove some limits on thread counts ([#1277](https://github.com/chrisbenincasa/tunarr/issues/1277)) ([4116225](https://github.com/chrisbenincasa/tunarr/commit/4116225975d78195ef7d05bb6b92f066b9723eea))
* **streaming:** rework hwdownload cuda filter ([04e30dc](https://github.com/chrisbenincasa/tunarr/commit/04e30dce8fa99faf797ecd625a562f37499a74c1))
* **ui:** allow getting nvidia debug details after getting vainfo debug ([8fa0bac](https://github.com/chrisbenincasa/tunarr/commit/8fa0bacdb5a9f0cd6a81f33edb0a1ec5307236d3))
* **ui:** fix default form state in weekly time slot editor when day is empty ([231e3bf](https://github.com/chrisbenincasa/tunarr/commit/231e3bf5932cf559c272d71f005b9c83b2a81331))
* **ui:** fix filler list clear all button ([cd2060b](https://github.com/chrisbenincasa/tunarr/commit/cd2060b5bfa6632c292fbc65b590a557dc922a63))
* **ui:** fix infinite API calls in Jellyfin grid ([#1300](https://github.com/chrisbenincasa/tunarr/issues/1300)) ([4a9b3a3](https://github.com/chrisbenincasa/tunarr/commit/4a9b3a3671c044820455edbc0d930ddcba130811))
* **ui:** fix stealth mode checkbox state ([136f9fa](https://github.com/chrisbenincasa/tunarr/commit/136f9fa9a3632ff42aa2a4e730512ecd9e4836ce)), closes [#1305](https://github.com/chrisbenincasa/tunarr/issues/1305)
* **ui:** properly filter various program types based on channel ([#1271](https://github.com/chrisbenincasa/tunarr/issues/1271)) ([8c32d8b](https://github.com/chrisbenincasa/tunarr/commit/8c32d8b233fe387a158cc2136ea6c075c2de1f6d))
* **ui:** reording custom show programs no longer affects episode number ([#1280](https://github.com/chrisbenincasa/tunarr/issues/1280)) ([231e3bf](https://github.com/chrisbenincasa/tunarr/commit/231e3bf5932cf559c272d71f005b9c83b2a81331)), closes [#1273](https://github.com/chrisbenincasa/tunarr/issues/1273)
* use execFile over exec when executing one-off child processes ([8fa0bac](https://github.com/chrisbenincasa/tunarr/commit/8fa0bacdb5a9f0cd6a81f33edb0a1ec5307236d3))
* use execFile over exec when executing one-off child processes ([#1309](https://github.com/chrisbenincasa/tunarr/issues/1309)) ([8fa0bac](https://github.com/chrisbenincasa/tunarr/commit/8fa0bacdb5a9f0cd6a81f33edb0a1ec5307236d3))


### Performance Improvements

* periodically flush event loop in ReconcileProgramDurationsTask ([622b8b3](https://github.com/chrisbenincasa/tunarr/commit/622b8b33da00792ac43208d6678e784330538833))

## [0.20.6](https://github.com/chrisbenincasa/tunarr/compare/v0.20.5...v0.20.6) (2025-07-20)


### Bug Fixes

* **server:** default is_edge_build env var flag to false if not present ([d9d7aa3](https://github.com/chrisbenincasa/tunarr/commit/d9d7aa39a4929eacdf29cbc222b179c53fe38b3c))
* **ui:** make version mismatch snackbar dismissable ([8294735](https://github.com/chrisbenincasa/tunarr/commit/8294735b9b2ba17ebfe16416c08fa7892052627a))

## [0.20.5](https://github.com/chrisbenincasa/tunarr/compare/v0.20.4...v0.20.5) (2025-07-20)


### Features

* **ui:** add ability to hide stealth channels from Tunarr guide page ([9decb37](https://github.com/chrisbenincasa/tunarr/commit/9decb371b90939157ce4ced7f10f678cdd1058d6)), closes [#1220](https://github.com/chrisbenincasa/tunarr/issues/1220)
* **ui:** add channel summary page ([#1190](https://github.com/chrisbenincasa/tunarr/issues/1190)) ([1f2e5eb](https://github.com/chrisbenincasa/tunarr/commit/1f2e5eb7c99698f732dcbeaa235f0965750fb1b3))
* **ui:** add debug panel showing relevant server environment variables ([c358dfc](https://github.com/chrisbenincasa/tunarr/commit/c358dfc60d9ed017e5c716863a2bb9d7a830afef))


### Bug Fixes

* **backend:** allow deleting channels that have subtitle preferences ([1c12b6b](https://github.com/chrisbenincasa/tunarr/commit/1c12b6b776934a139dc7d9881d165f27e0a096f4))
* ensure build versions match between web and server ([d31919c](https://github.com/chrisbenincasa/tunarr/commit/d31919c1b046bbe1226deed00361dbd11c01857b))
* insert filler / custom show content in chunks of 1000 to stay under sqlite limits ([907594e](https://github.com/chrisbenincasa/tunarr/commit/907594e0d5ae2380f04665098b5606a14dfdea20)), closes [#1255](https://github.com/chrisbenincasa/tunarr/issues/1255)
* **server:** fix incorrectly setting transcodeConfig.isDefault based on wrong field ([50b31a6](https://github.com/chrisbenincasa/tunarr/commit/50b31a68428e79f3be6a7a0564086be7490eb234))
* **streaming:** fix nvidia hwdownload compat with ffmpeg 7.2 ([#1253](https://github.com/chrisbenincasa/tunarr/issues/1253)) ([d4a1ed4](https://github.com/chrisbenincasa/tunarr/commit/d4a1ed4c57606efdc9e6f4b7b85a5a7869a361ac))
* **streaming:** include Quadro M2000, etc in special Maxwell cards that can decode HEVC ([be92d10](https://github.com/chrisbenincasa/tunarr/commit/be92d10bc67a92d985f91e85c93f0ed7302f8d9e))
* **streaming:** typo in rc-lookahead option ([a96d782](https://github.com/chrisbenincasa/tunarr/commit/a96d7823b167fad4cccd5b43aa815c8cb91881bb))
* **streaming:** various fixes to CUDA decoding and pipeline ([#1242](https://github.com/chrisbenincasa/tunarr/issues/1242)) ([0f25baa](https://github.com/chrisbenincasa/tunarr/commit/0f25baa18e6a0dc1711f1660cd85ae0646f99b0f))
* **streaming:** various fixes to pixel formats in nvidia pipeline ([#1251](https://github.com/chrisbenincasa/tunarr/issues/1251)) ([4c3a080](https://github.com/chrisbenincasa/tunarr/commit/4c3a0800315000619132477f0edcea76b4bde70f))
* **ui:** do not attempt to reach new plex servers with no access token ([2c37b83](https://github.com/chrisbenincasa/tunarr/commit/2c37b838464d0118916f1cfb843bf9c393cb817f))
* **ui:** ensure 'unsaved changes' popup doesn't erroneously pop-up in channel settings ([be6db83](https://github.com/chrisbenincasa/tunarr/commit/be6db8346bba3ad3a4dc7c5b8b2f30e25818fca4))
* **ui:** fix channel summary page for empty channels ([218e01c](https://github.com/chrisbenincasa/tunarr/commit/218e01ca9adbce46bbc83c8d8196a3f49c9e4b10))
* **ui:** remove extraneous unsaved changes warning in ffmpeg settings ([0c95cf0](https://github.com/chrisbenincasa/tunarr/commit/0c95cf0ce91bdd62bb2a541a1e69184363c83e24)), closes [#1244](https://github.com/chrisbenincasa/tunarr/issues/1244)


### UI Changes

* add health check for deprecated base docker image tags ([3c5ea42](https://github.com/chrisbenincasa/tunarr/commit/3c5ea4244435a818021052dbc915cf5f5e418ee5))
* calculate guide item width to better fill container ([d9f5e12](https://github.com/chrisbenincasa/tunarr/commit/d9f5e126ec95e63ba49f6a0a456aae842c8f4be9))
* trialing out brighter secondary colors in dark mode ([6e21d5b](https://github.com/chrisbenincasa/tunarr/commit/6e21d5bdc927c5e60b9cdb9b25b8308cc1956836))
* various fixes to how the guide page is displayed ([#1248](https://github.com/chrisbenincasa/tunarr/issues/1248)) ([6438a0d](https://github.com/chrisbenincasa/tunarr/commit/6438a0db0269a4644298afdbbef6925354f07b0c))

## [0.20.4](https://github.com/chrisbenincasa/tunarr/compare/v0.20.3...v0.20.4) (2025-06-16)


### Bug Fixes

* **ui:** ensure local state is always updated after querying media sources ([ce40a9f](https://github.com/chrisbenincasa/tunarr/commit/ce40a9f9376671e900ae087c4c58fe567692fd74))
* **ui:** fix programs disappearing from channel after save ([e2722cc](https://github.com/chrisbenincasa/tunarr/commit/e2722cc9929e42ff5d6de61b34cd3b93d0da3dde))

## [0.20.3](https://github.com/chrisbenincasa/tunarr/compare/v0.20.2...v0.20.3) (2025-06-15)


### Bug Fixes

* **web:** remove all usages of lodash chain from web ([3fb506e](https://github.com/chrisbenincasa/tunarr/commit/3fb506ed0d34ff77ce833d8520318d0ba7e5d510)), closes [#1235](https://github.com/chrisbenincasa/tunarr/issues/1235)

## [0.20.2](https://github.com/chrisbenincasa/tunarr/compare/v0.20.1...v0.20.2) (2025-06-15)


### Features

* **backend:** add support for Tunarr worker thread pools ([#1225](https://github.com/chrisbenincasa/tunarr/issues/1225)) ([f45b873](https://github.com/chrisbenincasa/tunarr/commit/f45b873a26f456ff58c3ab678d266180cec21eae))
* **time-slots:** allow scheduling any custom shows via time slots ([#1227](https://github.com/chrisbenincasa/tunarr/issues/1227)) ([c7de6a1](https://github.com/chrisbenincasa/tunarr/commit/c7de6a1ca4199ccf277fdd9870fa1df7b6b014a0))


### Bug Fixes

* **backend:** break injection dependency cycle with worker pool ([3f75295](https://github.com/chrisbenincasa/tunarr/commit/3f75295a2fa2d4da9d2e7d60e49d35f77d902b56))
* **backend:** pass correct message back from worker pool ([947e2e6](https://github.com/chrisbenincasa/tunarr/commit/947e2e6ef8b55adbc623659288a051a5d924ff95))
* **ui:** dark mode toggle could sometimes flash ([ce844ed](https://github.com/chrisbenincasa/tunarr/commit/ce844edc80df7935c2ea1d93c37d10eb61525493))


### Performance Improvements

* **backend:** add performance metrics to worker pool ([947e2e6](https://github.com/chrisbenincasa/tunarr/commit/947e2e6ef8b55adbc623659288a051a5d924ff95))
* **scheduling:** do not create new arrays when pushing flex into time slot schedule ([947e2e6](https://github.com/chrisbenincasa/tunarr/commit/947e2e6ef8b55adbc623659288a051a5d924ff95))

## [0.20.1](https://github.com/chrisbenincasa/tunarr/compare/v0.20.0...v0.20.1) (2025-06-06)


### Bug Fixes

* **cuda:** ensure unscaled output properly sets pixel format when burning subtitles ([dbc29f0](https://github.com/chrisbenincasa/tunarr/commit/dbc29f0d7184c6980409cec7013bc8bb16023d36))
* do not outright fail stream if external subtitles cannot be downloaded ([11dae74](https://github.com/chrisbenincasa/tunarr/commit/11dae74b6707748230256df38748320b7e3f0807))
* properly handle all item types in Jellyfin/Emby program selectors ([#1214](https://github.com/chrisbenincasa/tunarr/issues/1214)) ([a311d8f](https://github.com/chrisbenincasa/tunarr/commit/a311d8f9645d881eb11db1d4023c854bc8d55b08))
* **streaming:** format error log timestamps as unix timestamps to avoid colon issues on Windows ([9fb52d9](https://github.com/chrisbenincasa/tunarr/commit/9fb52d97a78623f5da04c282e73f755aaec29017))
* **streaming:** generate correct font file paths for error streams on Windows ([2d052f7](https://github.com/chrisbenincasa/tunarr/commit/2d052f751ef9597d076b836b24f2b473037a4839))
* **subtitles:** use double quotes for output paths to fix error on Windows ([749fc14](https://github.com/chrisbenincasa/tunarr/commit/749fc14aca1e36c6baa2549ad9d296356a02d96e))
* **subtitles:** use proper path.dirname when downloading external subtitles ([ccc2898](https://github.com/chrisbenincasa/tunarr/commit/ccc28988777072981d87a950bf8223a045e4f39d))


### UI Changes

* include release year in grid view, when possible ([f009c32](https://github.com/chrisbenincasa/tunarr/commit/f009c32bd59b3b58f5e8754200ba660c70a253c3))

## [0.20.0](https://github.com/chrisbenincasa/tunarr/compare/v0.19.3...v0.20.0) (2025-06-03)


### ⚠ BREAKING CHANGES

* official DB support for music / other video program types ([#1207](https://github.com/chrisbenincasa/tunarr/issues/1207))
* add subtitle support with multi-level configuration ([#1167](https://github.com/chrisbenincasa/tunarr/issues/1167))

### Features

* add subtitle support with multi-level configuration ([#1167](https://github.com/chrisbenincasa/tunarr/issues/1167)) ([a5a072e](https://github.com/chrisbenincasa/tunarr/commit/a5a072ef03408b899f313ff57914e8803864fc8a))
* official DB support for music / other video program types ([#1207](https://github.com/chrisbenincasa/tunarr/issues/1207)) ([6f7c4d3](https://github.com/chrisbenincasa/tunarr/commit/6f7c4d33bff5cec39bd4bdeaedb560625c356e63))


### Bug Fixes

* allow clicking directly next to guide timeline indicator ([b12c40e](https://github.com/chrisbenincasa/tunarr/commit/b12c40e5336e9df8e31ae72b266835cb9764edcb)), closes [#1205](https://github.com/chrisbenincasa/tunarr/issues/1205)
* always request recurisve=true for JF libraries ([8b609e0](https://github.com/chrisbenincasa/tunarr/commit/8b609e04dbc7251bd97a00c7048d7eb39a7b39ba))
* change subtitle preferences priority column from numeric to integer ([236b6a1](https://github.com/chrisbenincasa/tunarr/commit/236b6a116e34f6d902f3e9a7ee8dcebafcec399e))
* do not pick unextracted subtitle streams ([477d25f](https://github.com/chrisbenincasa/tunarr/commit/477d25f1d8a3a66448a1b2206f820a0b90112592))
* download external subtitles to local cache ([132a206](https://github.com/chrisbenincasa/tunarr/commit/132a206ab729a76d429aa2cfdd2f73dfb379642d))
* ensure correct channel/programming data always fetched ([c759101](https://github.com/chrisbenincasa/tunarr/commit/c7591019ca80e4d0c78326b4de56619a2605ea9a)), closes [#1194](https://github.com/chrisbenincasa/tunarr/issues/1194)
* fix weekly time slot deleting and editing issues ([bd253fd](https://github.com/chrisbenincasa/tunarr/commit/bd253fdafd6a944be82a652d947b33b262a2d3fa))
* invert checkbox for old/new ffmpeg pipeline ([7635225](https://github.com/chrisbenincasa/tunarr/commit/7635225f4b7a9224b9ef678b3dd366bc167bbef0))
* multiple fixes to subtitle streaming / extraction ([#1208](https://github.com/chrisbenincasa/tunarr/issues/1208)) ([9a61543](https://github.com/chrisbenincasa/tunarr/commit/9a61543e8acfceac2a3b03c2e698f3759ec2ee25))
* properly set filler list play cache entry ([7b32acb](https://github.com/chrisbenincasa/tunarr/commit/7b32acbbeb2cc7cdd2bad242db8dcec0ec968021))
* properly set lastFlushTime in InMemoryCachedDbAdapter ([1f54a89](https://github.com/chrisbenincasa/tunarr/commit/1f54a8935acacec65148f75d83f721daee6cd765))
* properly set output pixel format when using CUDA hardware download filter ([5e45dbf](https://github.com/chrisbenincasa/tunarr/commit/5e45dbf5f83273af129916742e77362150d50696))
* remove jellyfin item type checking when starting stream ([ff5a4e7](https://github.com/chrisbenincasa/tunarr/commit/ff5a4e7b283fc90380e578d0fecb44944006ee22))
* remove other program type checks for media sources ([fbc903e](https://github.com/chrisbenincasa/tunarr/commit/fbc903e05b21cdeddbbecde13f44657df332faee))
* update Emby types with more recent OpenAPI definition ([#1211](https://github.com/chrisbenincasa/tunarr/issues/1211)) ([350b7c0](https://github.com/chrisbenincasa/tunarr/commit/350b7c022fe4376f9ba85b7433be3e9674f5713e))
* use default subtitle stream if channel has no preferences but subtitles enabled ([1653a05](https://github.com/chrisbenincasa/tunarr/commit/1653a050c32665a9a5e86bc742fe645246ec8948))


### UI Changes

* hide leading edge checkbox is intemrittent watermarks are disabled ([143121c](https://github.com/chrisbenincasa/tunarr/commit/143121c1e8342fab4c618a38fcf20808cc4f88d9))
* implement horizontal scrolling in guide page ([98331d0](https://github.com/chrisbenincasa/tunarr/commit/98331d004164631ca5dd891ad7fe20bd966d1408)), closes [#1197](https://github.com/chrisbenincasa/tunarr/issues/1197)
* show hardware acceleration value in Transcode config table by default ([f66cfc6](https://github.com/chrisbenincasa/tunarr/commit/f66cfc6344960ead34be9e6801d53d3827da3496))

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
