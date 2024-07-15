import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { merge, padStart } from 'lodash-es';
import pluralize from 'pluralize';

dayjs.extend(duration);
dayjs.extend(relativeTime);

type Options = {
  exact: boolean;
  style: 'short' | 'full';
};

const defaultOptions: Options = {
  exact: false,
  style: 'full',
};

const styleStrings = {
  full: {
    day: 'day',
    hour: 'hour',
    minutes: 'min',
  },
  short: {
    day: 'd',
    hour: 'h',
    minutes: 'm',
  },
};

export function betterHumanize(
  dur: duration.Duration,
  options: Partial<Options> = {},
) {
  const mergedOpts = merge({}, defaultOptions, options);
  const days = Math.floor(dur.asDays());
  const hrs = Math.floor(dur.asHours() % 24);
  const mins = Math.round(dur.asMinutes() % 60);
  const seconds = Math.floor(dur.asSeconds() % 60);
  let builder = '';

  const daysStr = styleStrings[mergedOpts.style]['day'];
  const hoursStr = styleStrings[mergedOpts.style]['hour'];
  const minStr = styleStrings[mergedOpts.style]['minutes'];

  if (days >= 1) {
    const d =
      mergedOpts.style === 'full' ? ' ' + pluralize(daysStr, days) : daysStr;
    builder += `${days}${d}`;
  }

  if (hrs >= 1) {
    const d =
      mergedOpts.style === 'full' ? ' ' + pluralize(hoursStr, hrs) : hoursStr;
    if (builder.length > 0 && mergedOpts.style === 'full') {
      builder += ' ';
    }
    builder += `${hrs}${d}`;
  }

  if (mins >= 1) {
    const d =
      mergedOpts.style === 'full' ? ' ' + pluralize(minStr, mins) : minStr;
    if (builder.length > 0 && mergedOpts.style === 'full') {
      builder += ' ';
    }
    if (hrs < 1) {
      const prefix = seconds > 0 && !mergedOpts.exact ? 'about ' : '';
      builder += `${prefix}${padStart(mins.toString(), 2, '0')}${d}`;
    } else {
      builder += `${hrs}${d}`;
    }
  }

  if (builder.length === 0) {
    return mergedOpts.style === 'short' ? '0s' : dur.humanize();
  } else {
    return builder;
  }
}
