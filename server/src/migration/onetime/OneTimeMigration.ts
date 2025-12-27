import type { Logger } from '@/util/logging/LoggerFactory.js';
import { injectable } from 'inversify';

/**
 * Metadata for a one-time migration
 */
export interface OneTimeMigrationMetadata {
  /**
   * Unique identifier for this migration.
   * Should be descriptive and stable (never change once deployed).
   * Format: snake_case, e.g., "initial_media_library_scan"
   */
  id: string;

  /**
   * Human-readable description of what this migration does
   */
  description: string;

  /**
   * Optional list of migration IDs that must complete before this one runs
   */
  dependencies?: string[];

  /**
   * Optional: if true, this migration can be run multiple times
   * Default: false (most migrations should only run once)
   */
  allowRerun?: boolean;
}

/**
 * Interface for one-time migrations
 */
export interface IOneTimeMigration {
  readonly metadata: OneTimeMigrationMetadata;

  /**
   * Check if this migration should run.
   * This allows the migration to determine if it's already been applied
   * by checking application state (not just the tracking record).
   *
   * @returns true if the migration should run, false if it should be skipped
   */
  shouldRun(): Promise<boolean>;

  /**
   * Execute the migration logic
   */
  execute(): Promise<void>;

  /**
   * Optional: rollback logic if the migration fails
   * Most migrations won't implement this, but it's available if needed
   */
  rollback?(): Promise<void>;
}

/**
 * Base class for one-time migrations with common utilities
 */
@injectable()
export abstract class OneTimeMigration implements IOneTimeMigration {
  abstract metadata: OneTimeMigrationMetadata;

  protected abstract logger: Logger;

  /**
   * Default implementation: always run if not already executed
   * Override this if you need custom logic
   */
  async shouldRun(): Promise<boolean> {
    return true;
  }

  abstract execute(): Promise<void>;
}
