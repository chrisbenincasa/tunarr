import { round } from 'lodash-es';

// The limit is stored in seconds and edited in minutes.

export function secondsToMinutes(seconds: number) {
  return round(seconds / 60, 2);
}

export function minutesToSeconds(text: string) {
  const minutes = Number(text);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0;
}
