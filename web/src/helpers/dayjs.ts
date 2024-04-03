import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { padStart } from 'lodash-es';

dayjs.extend(duration);
dayjs.extend(relativeTime);

export function betterHumanize(dur: duration.Duration) {
  const hrs = Math.floor(dur.asHours());
  const mins = Math.floor(dur.asMinutes() % 60);
  if (hrs >= 1) {
    const s = hrs >= 2 ? 's' : '';
    const ms = mins === 1 ? '' : 's';
    return `${hrs} hour${s} ${padStart(mins.toString(), 2, '0')} min${ms}`;
  } else if (mins >= 1) {
    const ms = mins === 1 ? '' : 's';
    return `${padStart(mins.toString(), 2, '0')} min${ms}`;
  } else {
    return dur.humanize();
  }
}
