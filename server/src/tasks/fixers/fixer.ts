import { EntityManager } from '@mikro-orm/better-sqlite';
import { withDb } from '../../dao/dataSource.js';

export default abstract class Fixer {
  // False if the fixed data isn't required for proper server functioning
  canRunInBackground: boolean = false;

  async run() {
    return withDb((em) => this.runInternal(em));
  }

  protected abstract runInternal(em: EntityManager): Promise<void>;
}
