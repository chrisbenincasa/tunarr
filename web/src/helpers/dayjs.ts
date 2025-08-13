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
    seconds: 'second',
  },
  short: {
    day: 'd',
    hour: 'h',
    minutes: 'm',
    seconds: 's',
  },
};

export function betterHumanize(
  dur: duration.Duration,
  options: Partial<Options> = {},
) {
  const mergedOpts = merge({}, defaultOptions, options);
  const days = Math.floor(dur.asDays());
  const hrs = Math.floor(dur.asHours() % 24);
  const mins = Math.floor(dur.asMinutes() % 60);
  const seconds = Math.floor(dur.asSeconds() % 60);
  const builder = [];

  const {
    day: daysStr,
    hour: hoursStr,
    minutes: minStr,
    seconds: secStr,
  } = styleStrings[mergedOpts.style];

  if (+dur === 0) {
    return `0 mins`;
  }

  if (days >= 1) {
    const d =
      mergedOpts.style === 'full' ? ' ' + pluralize(daysStr, days) : daysStr;
    builder.push(`${days}${d}`);
  }

  if (hrs >= 1) {
    const d =
      mergedOpts.style === 'full' ? ' ' + pluralize(hoursStr, hrs) : hoursStr;
    builder.push(`${hrs}${d}`);
  }

  if (mins >= 1) {
    const minsN = Math.round(mins);
    const d =
      mergedOpts.style === 'full' ? ' ' + pluralize(minStr, minsN) : minStr;
    if (hrs < 1 && days < 1) {
      const prefix = seconds > 0 && !mergedOpts.exact ? 'about ' : '';
      builder.push(`${prefix}${padStart(minsN.toString(), 2, '0')}${d}`);
    } else {
      builder.push(`${padStart(minsN.toString(), 2, '0')}${d}`);
    }
  }

  if (builder.length === 0) {
    if (seconds > 0) {
      const secN = Math.round(seconds);
      const d =
        mergedOpts.style === 'full' ? ' ' + pluralize(secStr, secN) : secStr;
      return `${padStart(secN.toString(), 2, '0')}${d}`;
    }

    return mergedOpts.style === 'short' ? '0s' : dur.humanize();
  } else {
    return builder.join(' ');
  }
}
