import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceLibraryRefresher } from '@/services/MediaSourceLibraryRefresher.js';
import { MediaSourceScanCoordinator } from '@/services/scanner/MediaSourceScanCoordinator.js';
import { KEYS } from '@/types/inject.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import {
  OneTimeMigration,
  type OneTimeMigrationMetadata,
} from '../OneTimeMigration.js';

/**
 * Migration to scan media source libraries that have existing programs.
 *
 * This migration:
 * 1. Refreshes the list of libraries from all media sources
 * 2. Identifies libraries that have programs in the database
 * 3. Queues scans for those libraries to update metadata
 *
 * Idempotency: Safe to run multiple times - will only scan libraries
 * that still have programs and haven't been recently scanned.
 */
@injectable()
export class InitialMediaLibraryScanMigration extends OneTimeMigration {
  metadata: OneTimeMigrationMetadata = {
    id: 'initial_media_library_scan',
    description:
      'Scan media source libraries that have existing programs in the database',
    dependencies: [], // No dependencies on other migrations
  };

  constructor(
    @inject(KEYS.Logger) protected logger: Logger,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MediaSourceLibraryRefresher)
    private libraryRefresher: MediaSourceLibraryRefresher,
    @inject(MediaSourceScanCoordinator)
    private scanCoordinator: MediaSourceScanCoordinator,
  ) {
    super();
  }

  /**
   * Check if we should run this migration.
   * We'll run if there are any programs in the database.
   */
  async shouldRun(): Promise<boolean> {
    // Get all media sources
    const mediaSources = await this.mediaSourceDB.getAll();

    for (const mediaSource of mediaSources) {
      // Check if this media source has any programs
      const programs = await this.programDB.getProgramsForMediaSource(
        mediaSource.uuid,
      );

      if (programs.length > 0) {
        this.logger.debug(
          '[Migration: %s] Found %d programs for media source %s (%s), migration should run',
          this.metadata.id,
          programs.length,
          mediaSource.name,
          mediaSource.uuid,
        );
        return true;
      }
    }

    this.logger.debug(
      '[Migration: %s] No programs found in database, skipping library scan',
      this.metadata.id,
    );
    return false;
  }

  async execute(): Promise<void> {
    this.logger.debug(
      '[Migration: %s] Starting media library scan migration',
      this.metadata.id,
    );

    // Step 1: Refresh all media source libraries
    this.logger.debug(
      '[Migration: %s] Refreshing media source libraries...',
      this.metadata.id,
    );
    await this.libraryRefresher.refreshAll();
    this.logger.debug(
      '[Migration: %s] Library refresh complete',
      this.metadata.id,
    );

    // Step 2: Get all media sources with their libraries
    const mediaSources = await this.mediaSourceDB.getAll();
    this.logger.debug(
      '[Migration: %s] Found %d media sources to process',
      this.metadata.id,
      mediaSources.length,
    );

    let totalLibrariesQueued = 0;

    // Step 3: For each media source, queue scans for libraries with programs
    for (const mediaSource of mediaSources) {
      this.logger.debug(
        '[Migration: %s] Processing media source: %s (%s)',
        this.metadata.id,
        mediaSource.name,
        mediaSource.type,
      );

      // This thereotically shouldn't happen right on the jump to 1.0
      // because nobody on <1.0 should be able to add this source type.
      if (mediaSource.type === 'local') {
        this.logger.debug(
          '[Migration: %s] Skipping local media source %s',
          this.metadata.id,
          mediaSource.name,
        );
        continue;
      }

      const libraries = mediaSource.libraries ?? [];
      this.logger.debug(
        '[Migration: %s] Media source %s has %d libraries',
        this.metadata.id,
        mediaSource.name,
        libraries.length,
      );

      for (const library of libraries) {
        // Check if this library has any programs
        // const programs =
        //   await this.programDB.getMediaSourceLibraryPrograms(library.uuid);

        this.logger.debug(
          '[Migration: %s] Queuing scan of library %s (ID = %s)',
          this.metadata.id,
          library.name,
          library.uuid,
          // programs.length,
        );

        // Queue a scan for this library
        const queued = await this.scanCoordinator.add({
          libraryId: library.uuid,
          forceScan: true,
        });

        if (queued) {
          totalLibrariesQueued++;
          this.logger.debug(
            '[Migration: %s] Successfully queued scan for library %s',
            this.metadata.id,
            library.name,
          );
        } else {
          this.logger.warn(
            '[Migration: %s] Failed to queue scan for library %s (%s)',
            this.metadata.id,
            library.name,
            library.uuid,
          );
        }
        // if (programs.length > 0) {
        // } else {
        //   this.logger.debug(
        //     '[Migration: %s] Library %s has no programs, skipping scan',
        //     this.metadata.id,
        //     library.name,
        //   );
        // }
      }
    }

    this.logger.info(
      '[Migration: %s] Migration complete: queued scans for %d libraries',
      this.metadata.id,
      totalLibrariesQueued,
    );

    // Note: We don't wait for scans to complete - they run in the background
    // The migration is considered complete once scans are queued
  }
}
