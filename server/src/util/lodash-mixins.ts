// import { isNil, mixin, reduce } from 'lodash-es';

// function groupByTyped<T, K extends keyof any>(
//   arr: T[] | undefined | null,
//   iterator: (t: T) => K,
// ): Record<K, T[]> {
//   if (isNil(arr)) {
//     return {} as Record<K, T[]>;
//   }
//   return reduce(
//     arr,
//     (prev, curr) => {
//       const key = iterator(curr);
//       const last = prev[key];
//       return {
//         ...prev,
//         [key]: last ? [...last, curr] : [curr],
//       };
//     },
//     {} as Record<K, T[]>,
//   );
// }

// mixin({ groupByTyped });
