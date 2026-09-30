import { expect, type Page, type Request } from '@playwright/test';

const QUIET_WINDOW_MS = 750;
const SETTLE_TIMEOUT_MS = 20_000;

export type PageHealth = {
  problems: string[];
  warnings: string[];
  settle: () => Promise<void>;
};

// Records everything that signals a broken page: uncaught exceptions, console
// errors (React reports its warnings there), and 5xx API responses.
// Problems matching `known` are dropped.
export function watchPageHealth(page: Page, known: RegExp[]): PageHealth {
  const problems: string[] = [];
  const warnings: string[] = [];
  const inFlight = new Set<Request>();
  let lastActivity = Date.now();

  const isApiCall = (req: Request) =>
    ['fetch', 'xhr'].includes(req.resourceType()) &&
    new URL(req.url()).pathname.startsWith('/api/');

  const report = (problem: string) => {
    if (!known.some((re) => re.test(problem))) {
      problems.push(problem);
    }
  };

  page.on('pageerror', (err) => {
    const frames = (err.stack ?? '').split('\n').slice(1, 4).join(' | ');
    report(`Uncaught exception: ${err.message} @ ${frames}`);
  });

  page.on('console', (msg) => {
    // Resource-load errors name the URL only in the location.
    const text = msg.text().startsWith('Failed to load resource')
      ? `${msg.text()} ${msg.location().url}`
      : msg.text();
    if (msg.type() === 'error') {
      report(`console.error: ${text}`);
    } else if (msg.type() === 'warning') {
      warnings.push(text);
    }
  });

  page.on('request', (req) => {
    if (isApiCall(req)) {
      inFlight.add(req);
      lastActivity = Date.now();
    }
  });

  const finish = (req: Request) => {
    if (inFlight.delete(req)) {
      lastActivity = Date.now();
    }
  };
  page.on('requestfinished', finish);
  page.on('requestfailed', finish);

  page.on('response', (res) => {
    if (isApiCall(res.request()) && res.status() >= 500) {
      report(`${res.status()} from ${res.request().method()} ${res.url()}`);
    }
  });

  // SSE connections stay open, so network idle never arrives. A page counts
  // as settled once no API call has started or finished for a short window.
  // On timeout the received value names the calls still pending.
  const recent: string[] = [];
  page.on('request', (req) => {
    if (isApiCall(req)) {
      recent.push(`${req.method()} ${new URL(req.url()).pathname}`);
      recent.splice(0, recent.length - 10);
    }
  });

  const settle = async () => {
    await expect
      .poll(
        () => {
          if (inFlight.size > 0) {
            return `in flight: ${[...inFlight].map((r) => r.url()).join(', ')}`;
          }
          if (Date.now() - lastActivity <= QUIET_WINDOW_MS) {
            return `recent: ${recent.join(', ')}`;
          }
          return 'settled';
        },
        { timeout: SETTLE_TIMEOUT_MS, intervals: [100] },
      )
      .toBe('settled');
  };

  return { problems, warnings, settle };
}
