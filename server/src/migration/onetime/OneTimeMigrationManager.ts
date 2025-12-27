import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { KEYS } from '@/types/inject.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { groupByUniq } from '@/util/index.js';
import { DirectedGraph } from 'graphology';
import * as dag from 'graphology-dag';
import { inject, injectable, multiInject } from 'inversify';
import type { IOneTimeMigration } from './OneTimeMigration.js';

export interface MigrationExecutionResult {
  migrationId: string;
  success: boolean;
  skipped: boolean;
  error?: string;
  durationMs: number;
}

@injectable()
export class OneTimeMigrationManager {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @multiInject(KEYS.OneTimeMigration)
    private migrations: IOneTimeMigration[],
  ) {}

  /**
   * Execute all pending one-time migrations
   */
  async runMigrations(): Promise<MigrationExecutionResult[]> {
    this.logger.info('Starting one-time migration execution');

    const results: MigrationExecutionResult[] = [];
    const sortedMigrations = this.topologicalSort();

    for (const migration of sortedMigrations) {
      const result = await this.executeSingleMigration(migration);
      results.push(result);

      // If a migration fails and it's not allowed to rerun, stop
      if (!result.success && !migration.metadata.allowRerun) {
        this.logger.error(
          'Migration %s failed. Stopping migration execution.',
          migration.metadata.id,
        );
        break;
      }
    }

    const successful = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success).length;

    this.logger.info(
      'One-time migrations complete: %d successful, %d skipped, %d failed',
      successful,
      skipped,
      failed,
    );

    return results;
  }

  /**
   * Execute a single migration with tracking and error handling
   */
  private async executeSingleMigration(
    migration: IOneTimeMigration,
  ): Promise<MigrationExecutionResult> {
    const { id, description, allowRerun } = migration.metadata;
    const startTime = Date.now();

    // Check if already executed
    if (this.settingsDB.isMigrationExecuted(id) && !allowRerun) {
      this.logger.debug('Migration %s already executed, skipping', id);
      return {
        migrationId: id,
        success: true,
        skipped: true,
        durationMs: 0,
      };
    }

    this.logger.info('Executing migration: %s - %s', id, description);

    try {
      // Check if migration should run (idempotency check)
      const shouldRun = await migration.shouldRun();
      if (!shouldRun) {
        this.logger.info(
          'Migration %s determined it should not run (already applied)',
          id,
        );
        await this.settingsDB.markMigrationExecuted(id);
        return {
          migrationId: id,
          success: true,
          skipped: true,
          durationMs: Date.now() - startTime,
        };
      }

      // Execute the migration
      await migration.execute();

      // Mark as executed
      await this.settingsDB.markMigrationExecuted(id);

      const duration = Date.now() - startTime;
      this.logger.info(
        'Migration %s completed successfully in %dms',
        id,
        duration,
      );

      return {
        migrationId: id,
        success: true,
        skipped: false,
        durationMs: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(error, 'Migration %s failed after %dms', id, duration);

      await this.settingsDB.markMigrationFailed(id, errorMessage);

      // Attempt rollback if available
      if (migration.rollback) {
        try {
          this.logger.info('Attempting rollback for migration %s', id);
          await migration.rollback();
          this.logger.info('Rollback successful for migration %s', id);
        } catch (rollbackError) {
          this.logger.error(
            rollbackError,
            'Rollback failed for migration %s',
            id,
          );
        }
      }

      return {
        migrationId: id,
        success: false,
        skipped: false,
        error: errorMessage,
        durationMs: duration,
      };
    }
  }

  /**
   * Sort migrations topologically based on dependencies
   */
  private topologicalSort(): IOneTimeMigration[] {
    const migrationsById = groupByUniq(this.migrations, (m) => m.metadata.id);

    const graph = new DirectedGraph();

    // Add all migration nodes
    for (const migration of this.migrations) {
      graph.addNode(migration.metadata.id);
    }

    // Add edges for dependencies
    for (const migration of this.migrations) {
      const deps = migration.metadata.dependencies ?? [];
      for (const dep of deps) {
        if (!graph.hasNode(dep)) {
          this.logger.warn(
            'Migration %s depends on unknown migration %s',
            migration.metadata.id,
            dep,
          );
          continue;
        }
        graph.addDirectedEdge(dep, migration.metadata.id);
      }
    }

    // Detect cycles
    if (dag.hasCycle(graph)) {
      throw new Error(
        'Circular dependency detected in one-time migrations',
      );
    }

    // Get sorted order
    const sortedIds = dag.topologicalSort(graph);

    // Return migrations in sorted order
    return sortedIds.map((id) => migrationsById[id]);
  }
}
