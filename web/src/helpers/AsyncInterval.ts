import { delay } from '../hooks/useAsyncInterval';

export class AsyncInterval {
  #fn: (interval: AsyncInterval) => Promise<void>;
  #delayMs: number | null;
  #running = false;

  constructor(
    fn: (interval: AsyncInterval) => Promise<void>,
    delayMs: number | null,
  ) {
    this.#fn = fn;
    this.#delayMs = delayMs;
  }

  start() {
    if (this.#running || !this.#delayMs) return;
    this.#running = true;
    void this.cycle();
  }

  stop() {
    if (this.#running) this.#running = false;
  }

  async cycle() {
    await this.#fn(this);
    await delay(this.#delayMs!);
    void this.cycle();
  }
}
