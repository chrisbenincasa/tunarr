export function booleanToNumber(b: boolean): number {
  return b ? 1 : 0;
}

export function numberToBoolean(n: number): boolean {
  return n === 0 ? false : true;
}
