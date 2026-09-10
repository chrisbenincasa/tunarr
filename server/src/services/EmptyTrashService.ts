import type { IChannelDB } from '@/db/interfaces/IChannelDB.js';
import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { ProgramStateRepository } from '@/db/program/ProgramStateRepository.js';
import type { ProgramGroupingType } from '@/db/schema/ProgramGrouping.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe } from '@/types/util.js';
import { wait } from '@/util/index.js';
import { InjectLogger } from '@/util/inject.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import type { EmptyTrashStatus } from '@tunarr/types/api';
import { Mutex } from 'async-mutex';
import { inject, injectable } from 'inversify';
import { EventService } from './EventService.ts';
import { MeilisearchService } from './MeilisearchService.ts';

/** Programs deleted per synchronous DELETE statement. */
export const EmptyTrashProgramBatchSize = 500;
/**
 * Groupings deleted per statement. Lower than the program batch because the
 * eligibility query runs two correlated NOT EXISTS per candidate row.
 */
const EmptyTrashGroupingBatchSize = 250;
/** Page size used when collecting every trashed ID for the lineup pass. */
const EmptyTrashIdPageSize = 10_000;
/**
 * `setTimeout(0)` rather than a microtask: only a real timer yields through the
 * poll phase, so pending socket I/O actually runs between batches.
 */
const EmptyTrashYieldMs = 0;

/**
 * Leaves before roots. A show only becomes deletable once its seasons are gone,
 * because `program_grouping.show_uuid` cascades.
 */
const GroupingDeletionOrder: readonly (readonly ProgramGroupingType[])[] = [
  ['season', 'album'],
  ['show', 'artist'],
];

const idleStatus = (): EmptyTrashStatus => ({
  state: 'idle',
  total: 0,
  deleted: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
});

/**
 * Drains the trash in small batches that yield to the event loop between each,
 * so a large empty-trash never stalls the HTTP server or an in-flight stream.
 *
 * The request is persisted, so an interrupted drain resumes after a restart.
 */
@injectable()
export class EmptyTrashService {
  @InjectLogger() declare private readonly logger: Logger;

  #mutex = new Mutex();
  #controller: Maybe<AbortController>;
  #cancelRequested = false;
  #status: EmptyTrashStatus = idleStatus();

  constructor(
    @inject(KEYS.ProgramStateRepository)
    private stateRepo: ProgramStateRepository,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(MeilisearchService) private search: MeilisearchService,
    @inject(KEYS.SettingsDB) private settings: ISettingsDB,
    @inject(EventService) private events: EventService,
  ) {}

  getStatus(): EmptyTrashStatus {
    return { ...this.#status };
  }

  /**
   * Records the request durably and starts a drain. A request made while one is
   * already running is an idempotent no-op, not a second drain.
   */
  async request(): Promise<EmptyTrashStatus> {
    if (this.#mutex.isLocked()) {
      return this.getStatus();
    }

    await this.settings.markEmptyTrashRequested(Date.now());
    this.#kick();
    return this.getStatus();
  }

  cancel(): EmptyTrashStatus {
    if (!this.#mutex.isLocked()) {
      return this.getStatus();
    }

    this.#cancelRequested = true;
    this.#controller?.abort();
    this.#status = { ...this.#status, state: 'cancelling' };
    return this.getStatus();
  }

  /**
   * Restarts a drain that was requested but never finished — a crash, a kill,
   * or a shutdown mid-run.
   */
  resumeIfRequested(): void {
    if (this.settings.pendingOperations.emptyTrashRequestedAt === null) {
      return;
    }

    if (this.#mutex.isLocked()) {
      return;
    }

    this.logger.info('Resuming interrupted empty trash operation');
    this.#kick();
  }

  #kick(): void {
    const controller = new AbortController();
    this.#controller = controller;
    this.#cancelRequested = false;

    void this.#mutex
      .runExclusive(() => this.#run(controller.signal))
      .catch((e) => {
        this.logger.error(e, 'Empty trash drain failed');
      });
  }

  async #run(signal: AbortSignal): Promise<void> {
    const total = await this.stateRepo.countMissingPrograms();
    this.#status = {
      state: 'running',
      total,
      deleted: 0,
      startedAt: Date.now(),
      finishedAt: null,
      error: null,
    };
    this.#pushEvent('started');

    let completed = false;
    let failed = false;
    try {
      // PHASE 1 - rewrite affected lineups to flex. Must happen before any
      // delete: once the program rows are gone the dangling lineup content IDs
      // can no longer be identified.
      const ids = new Set<string>();
      for await (const page of this.stateRepo.allMissingProgramIds(
        EmptyTrashIdPageSize,
      )) {
        for (const id of page) {
          ids.add(id);
        }
        await wait(EmptyTrashYieldMs);
        if (signal.aborted) {
          return;
        }
      }

      const changedChannels =
        await this.channelDB.removeProgramsFromAllLineups(ids);
      this.logger.debug(
        'Empty trash rewrote %d channel lineup(s) for %d trashed program(s)',
        changedChannels,
        ids.size,
      );
      ids.clear();

      // PHASE 2 - batched program deletes. Each DELETE cascades into the
      // program's child tables.
      let deleted = 0;
      while (!signal.aborted) {
        const batch = await this.stateRepo.nextMissingProgramIds(
          EmptyTrashProgramBatchSize,
        );
        if (batch.length === 0) {
          break;
        }

        await this.stateRepo.deleteProgramsByIds(batch);
        deleted += batch.length;
        this.#status = {
          ...this.#status,
          deleted,
          total: Math.max(this.#status.total, deleted),
        };

        // Enqueue only. Awaiting task completion would serialize the drain
        // behind Meilisearch's indexing queue.
        void this.#deleteSearchDocuments(batch);
        await wait(EmptyTrashYieldMs);
      }

      // PHASE 3 - guarded, leaves-first grouping deletes.
      if (!signal.aborted) {
        for (const types of GroupingDeletionOrder) {
          for (;;) {
            if (signal.aborted) {
              break;
            }

            const groupingIds =
              await this.stateRepo.nextDeletableMissingGroupingIds(
                types,
                EmptyTrashGroupingBatchSize,
              );
            if (groupingIds.length === 0) {
              break;
            }

            await this.stateRepo.deleteGroupingsByIds(groupingIds);
            void this.#deleteSearchDocuments(groupingIds);
            await wait(EmptyTrashYieldMs);
          }
        }
      }

      completed = !signal.aborted;
    } catch (e) {
      failed = true;
      this.#status = {
        ...this.#status,
        state: 'failed',
        error: e instanceof Error ? e.message : String(e),
        finishedAt: Date.now(),
      };
      this.#pushEvent('failed', 'error');
      // The pending flag is deliberately left set so the drain resumes on the
      // next boot.
      throw e;
    } finally {
      if (!failed) {
        this.#status = {
          ...this.#status,
          state: 'idle',
          finishedAt: Date.now(),
        };

        if (completed) {
          await this.#compactDatabase();
        }

        // Clear on clean completion or explicit user cancel only. A crash or a
        // shutdown must leave the flag set - that is what makes resume work.
        if (completed || this.#cancelRequested) {
          await this.settings.clearEmptyTrashRequested();
        }

        this.#pushEvent(completed ? 'completed' : 'cancelled');
      }
    }
  }

  async #deleteSearchDocuments(ids: string[]): Promise<void> {
    try {
      await this.search.deleteByIds(ids);
    } catch (e) {
      this.logger.warn(
        e,
        'Failed to remove %d emptied trash document(s) from the search index',
        ids.length,
      );
    }
  }

  /**
   * Reclaims the WAL grown by many small write transactions. Deliberately not
   * VACUUM, which is a long fully-blocking whole-file rewrite.
   */
  async #compactDatabase(): Promise<void> {
    try {
      await this.stateRepo.checkpointAndOptimize();
    } catch (e) {
      this.logger.warn(e, 'Failed to checkpoint database after emptying trash');
    }
  }

  #pushEvent(
    status: 'started' | 'completed' | 'cancelled' | 'failed',
    level: 'info' | 'error' = 'info',
  ): void {
    this.events.push({
      type: 'empty_trash',
      level,
      detail: {
        status,
        total: this.#status.total,
        deleted: this.#status.deleted,
      },
    });
  }
}
