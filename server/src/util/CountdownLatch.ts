export class CountdownLatch {
  private promise: Promise<void>;
  private resolve: () => void;

  constructor(private count: number) {
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  countDown() {
    if (this.count > 0) {
      this.count--;
      if (this.count === 0) {
        this.resolve();
      }
    }
  }

  wait(): Promise<void> {
    return this.promise;
  }
}
