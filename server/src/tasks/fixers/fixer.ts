import { EntityManager, withDb } from '../../dao/dataSource.js';

export default abstract class Fixer {
  async run() {
    return withDb((em) => this.runInternal(em));
  }

  protected abstract runInternal(em: EntityManager): Promise<void>;
}
