/**
 * A function that can create a unique ID for an instance of a given type
 */
export interface Canonicalizer<T> {
  getCanonicalId(t: T): string;
}
