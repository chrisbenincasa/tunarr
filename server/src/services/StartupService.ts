import { seq } from '@tunarr/shared/util';
import { DirectedGraph } from 'graphology';
import * as dag from 'graphology-dag';
import { inject, injectable, multiInject } from 'inversify';
import { isMainThread } from 'node:worker_threads';
import { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import { KEYS } from '../types/inject.ts';
import { groupByUniq } from '../util/index.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { MeilisearchService } from './MeilisearchService.ts';
import { IStartupTask } from './startup/IStartupTask.ts';

@injectable()
export class StartupService {
  #hasRun = false;
  #taskPromisesById: Record<string, Promise<void>> = {};

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.WorkerPool)
    private workerPool: IWorkerPool,
    @multiInject(KEYS.StartupTask) private startupTasks: IStartupTask[],
    @inject(MeilisearchService)
    public readonly searchService: MeilisearchService,
  ) {}

  async runStartupServices() {
    if (!this.#hasRun) {
      this.#hasRun = true;

      const tasksById = groupByUniq(this.startupTasks, (task) => task.id);
      const graph = new DirectedGraph();
      for (const task of this.startupTasks) {
        graph.addNode(task.id);
        for (const dep of task.dependencies) {
          graph.addDirectedEdge(dep, task.id);
        }
      }

      // this.startupTasks.
      const sortedOrder = dag.topologicalSort(graph);

      for (const taskId of sortedOrder) {
        const task = tasksById[taskId];
        if (!task) {
          this.logger.warn(
            'Unexpected state. Task ID %s not found in sorted graph',
            taskId,
          );
          continue;
        }
        if (task.dependencies.length > 0) {
          const depPromises = seq.collect(
            task.dependencies,
            (dep) => this.#taskPromisesById[dep],
          );

          this.#taskPromisesById[task.id] = Promise.all(depPromises).then(
            () => {
              this.logger.debug('Running startup task %s', task.id);
              task.start();
              return task.wait();
            },
          );
        } else {
          this.#taskPromisesById[task.id] = new Promise((resolve, reject) => {
            this.logger.info('Running startup task %s', task.id);
            task.start();
            task.wait().then(resolve).catch(reject);
          });
        }
      }

      await Promise.all(this.taskPromsies);

      await this.searchService.start();
      await this.searchService.sync();

      if (isMainThread) {
        this.workerPool.start();
      }
    }
  }

  private get taskPromsies() {
    return Object.values(this.#taskPromisesById);
  }
}
