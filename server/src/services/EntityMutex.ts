import { inject, injectable } from 'inversify';
import { MediaSourceLibrary } from '../db/schema/MediaSource.ts';
import { KEYS } from '../types/inject.ts';
import { MutexMap } from '../util/mutexMap.ts';

@injectable()
export class EntityMutex {
  constructor(@inject(KEYS.MutexMap) private mutexMap: MutexMap) {}

  async lock(key: string) {
    return this.mutexMap.getOrCreateLock(key);
  }

  async isLocked(key: string) {
    return (await this.lock(key)).isLocked();
  }

  async lockLibrary(library: MediaSourceLibrary) {
    return this.lock(this.libraryKey(library.mediaSourceId, library.uuid));
  }

  isLibraryLocked(library: MediaSourceLibrary) {
    return (
      this.mutexMap
        .getLockSync(this.libraryKey(library.mediaSourceId, library.uuid))
        ?.isLocked() ?? false
    );
  }

  getLockForLibrary(library: MediaSourceLibrary) {
    return this.lock(this.libraryKey(library.mediaSourceId, library.uuid));
  }

  libraryKey(mediaSourceId: string, libraryId: string) {
    return `media_source.${mediaSourceId}.library.${libraryId}`;
  }
}
