import type { Nullable } from '../types/util.ts';

// Simple stack
export class Stack<T> {
  #data: T[] = [];

  push(v: T) {
    this.#data.push(v);
  }

  peek(): Nullable<T> {
    if (this.isEmpty()) {
      return null;
    }
    return this.#data[this.#data.length - 1]!;
  }

  isEmpty(): boolean {
    return this.#data.length === 0;
  }

  pop(): Nullable<T> {
    if (this.isEmpty()) {
      return null;
    }
    return this.#data.pop() ?? null;
  }

  [Symbol.iterator](): Iterator<T> {
    let idx = 0;
    const arr = this.toArray();
    return {
      next: function () {
        if (idx < arr.length) {
          return { value: arr[idx++]!, done: false };
        } else {
          return { value: undefined, done: true };
        }
      },
    };
  }

  toArray(): T[] {
    return [...this.#data].reverse();
  }
}
