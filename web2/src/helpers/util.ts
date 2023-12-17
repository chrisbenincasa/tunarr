export async function sequentialPromises<T, U>(
  seq: ReadonlyArray<T>,
  itemFn: (item: T) => Promise<U>,
  opts?: { ms?: number },
): Promise<U[]> {
  const all = await seq.reduce(
    async (prev, item) => {
      const last = await prev;

      const result = await itemFn(item);

      if (opts?.ms) {
        await wait(opts?.ms);
      }

      return [...last, result];
    },
    Promise.resolve([] as U[]),
  );

  return Promise.all(all);
}

export const wait: (ms: number) => Promise<void> = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
