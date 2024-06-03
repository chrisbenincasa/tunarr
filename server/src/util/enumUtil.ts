import { map } from 'lodash-es';

export declare type EnumLike = {
  [k: string]: string | number;
  [nu: number]: string;
};

export function enumKeys<O extends object, K extends keyof O = keyof O>(
  obj: O,
): K[] {
  return Object.keys(obj).filter((k) => !Number.isNaN(k)) as K[];
}

export function enumValues<O extends object, K extends keyof O = keyof O>(
  obj: O,
): O[K][] {
  return map(
    Object.keys(obj).filter((k) => !Number.isNaN(k)) as K[],
    (k) => obj[k],
  );
}
