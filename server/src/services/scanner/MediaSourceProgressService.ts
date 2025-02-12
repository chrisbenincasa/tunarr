import dayjs from 'dayjs';
import events from 'events';
import { injectable } from 'inversify';
import { TypedEventEmitter } from '../../types/eventEmitter.ts';

type Events = {
  scanStart: (libraryId: string) => void;
  scanEnd: (libraryId: string) => void;
  scanProgress: (libraryId: string, percentComplete: number) => void;
};

abstract class Emitter extends (events.EventEmitter as new () => TypedEventEmitter<Events>) {}

type NotScanningState = {
  state: 'not_scanning';
};

type ScanningState = {
  state: 'in_progress';
  startedAt: dayjs.Dayjs;
  percentComplete: number;
};

type ScanState = NotScanningState | ScanningState;

const notScanningState: NotScanningState = { state: 'not_scanning' };

@injectable()
export class MediaSourceProgressService extends Emitter {
  #scanDetails: Map<string, ScanningState> = new Map();

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

  scanProgress(libraryId: string, percentComplete: number) {
    this.emit('scanProgress', libraryId, percentComplete);
    const existing = this.#scanDetails.get(libraryId);
    if (existing) {
      this.#scanDetails.set(libraryId, { ...existing, percentComplete });
    }
  }

  getScanProgress(libraryId: string): ScanState {
    return this.#scanDetails.get(libraryId) ?? notScanningState;
  }
}
