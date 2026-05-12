/// <reference types="@testing-library/jest-dom/vitest" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { i18n } from '@lingui/core';
import { cleanup } from '@testing-library/react';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { afterEach, beforeAll, expect } from 'vitest';

expect.extend(matchers);

// Load dayjs plugins needed by components
dayjs.extend(duration);
dayjs.extend(relativeTime);

// Initialize Lingui with an empty English catalog so components using
// <Trans> and t`` render their message IDs (English source strings) in tests.
beforeAll(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} });
});

// Automatically cleanup after each test
afterEach(() => {
  cleanup();
});
