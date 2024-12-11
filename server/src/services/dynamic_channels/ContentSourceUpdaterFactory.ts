import { Provider } from '@/util/Provider.ts';
import { DynamicContentConfigSource } from '@tunarr/types/api';
import { ContentSourceUpdater } from './ContentSourceUpdater.ts';

export class ContentSourceUpdaterFactory {
  constructor(
    private updaterProviderByType: Map<
      DynamicContentConfigSource['type'],
      Provider<ContentSourceUpdater<DynamicContentConfigSource>>
    >,
  ) {}

  getUpdater(
    type: DynamicContentConfigSource['type'],
  ): ContentSourceUpdater<DynamicContentConfigSource> {
    const updater = this.updaterProviderByType.get(type);
    if (!updater) {
      throw new Error('No updater bound for type: ' + type);
    }
    return updater.get();
  }
}
