import { isNonEmptyString } from '@tunarr/shared/util';

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
