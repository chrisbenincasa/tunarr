import { round } from 'lodash-es';

// The limit is stored in seconds and edited in minutes.

export function secondsToMinutes(seconds: number) {
  return round(seconds / 60, 2);
}

// Empty text means no limit. Text that is not a number of 0 or more returns
// NaN so form validation rejects it instead of saving 0.

export function minutesToSeconds(text: string) {
  if (text.trim() === '') {
    return 0;
  }
  const minutes = Number(text);
  return Number.isFinite(minutes) && minutes >= 0
    ? Math.round(minutes * 60)
    : NaN;
}
