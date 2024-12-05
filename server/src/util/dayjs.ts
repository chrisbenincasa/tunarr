import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(duration);
dayjs.extend(timezone);
dayjs.extend(utc);

export default dayjs;
