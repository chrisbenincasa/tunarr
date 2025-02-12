import dayjs from 'dayjs';
import events from 'events';
import { injectable } from 'inversify';
import { TypedEventEmitter } from '../../types/eventEmitter.ts';

type Events = {
  scanStart: (libraryId: string) => void;
  scanEnd: (libraryId: string) => void;
  scanProgress: (libraryId: string, percentComplete: number) => void;
  scanQueued: (libraryId: string) => void;
};

abstract class Emitter extends (events.EventEmitter as new () => TypedEventEmitter<Events>) {}

type NotScanningState = {
  state: 'not_scanning';
};

type QueuedState = {
  state: 'queued';
};

type ScanningState = {
  state: 'in_progress';
  startedAt: dayjs.Dayjs;
  percentComplete: number;
};

type ScanState = NotScanningState | QueuedState | ScanningState;

const notScanningState: NotScanningState = { state: 'not_scanning' };

type InProgressState = QueuedState | ScanningState;

@injectable()
export class MediaSourceProgressService extends Emitter {
  #scanDetails: Map<string, InProgressState> = new Map();

  constructor() {
    super();
  }

  scanStarted(libraryId: string) {
    this.emit('scanStart', libraryId);
    this.#scanDetails.set(libraryId, {
      state: 'in_progress',
      startedAt: dayjs(),
      percentComplete: 0,
    });
  }

  scanEnded(libraryId: string) {
    this.emit('scanEnd', libraryId);
    this.#scanDetails.delete(libraryId);
  }

  scanQueued(libraryId: string) {
    this.emit('scanQueued', libraryId);
    this.#scanDetails.set(libraryId, {
      state: 'queued',
    });
  }

  scanProgress(libraryId: string, percentComplete: number) {
    this.emit('scanProgress', libraryId, percentComplete);
    const existing = this.#scanDetails.get(libraryId);
    if (existing) {
      const start =
        existing.state === 'in_progress' ? existing.startedAt : dayjs();
      this.#scanDetails.set(libraryId, {
        state: 'in_progress',
        percentComplete,
        startedAt: start,
      });
    } else {
      const progress = {
        state: 'in_progress',
        startedAt: dayjs(),
        percentComplete: percentComplete,
      } satisfies ScanningState;
      this.#scanDetails.set(libraryId, progress);
    }
  }

  getScanProgress(libraryId: string): ScanState {
    return this.#scanDetails.get(libraryId) ?? notScanningState;
  }
}
