import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { afterEach } from 'vitest';

// Load dayjs plugins needed by components
dayjs.extend(duration);
dayjs.extend(relativeTime);

// Automatically cleanup after each test
afterEach(() => {
  cleanup();
});
