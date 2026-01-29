import { isNonEmptyString } from '@tunarr/shared/util';
import { Nilable } from '../types/util.ts';
import dayjs from './dayjs.ts';

const articleRegex = /^(A|An|The)\s+(.*)/i;

export function titleToSortTitle(title: string) {
  if (!isNonEmptyString(title)) {
    return title;
  }

  title = title.trim();

  const match = title.match(articleRegex);

  let sortTitle: string;

  if (match && match[2]) {
    sortTitle = match[2];
  } else {
    sortTitle = title;
  }

  return sortTitle.toLowerCase();
}

export function parseReleaseDate(dateStr: Nilable<string>) {
  if (!isNonEmptyString(dateStr)) {
    return null;
  }
  const parsed = dayjs(dateStr);
  if (!parsed.isValid()) {
    return null;
  }
  return parsed;
}
