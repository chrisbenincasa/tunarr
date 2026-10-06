import pino, { multistream } from 'pino';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
// LoggerFactory builds the root logger on load, so it must load before
// LoggerWrapper, as it does in the server.
import type { Logger } from './LoggerFactory.ts';
import './LoggerFactory.ts';
import { RootLoggerWrapper } from './LoggerWrapper.ts';

function createRoot() {
  const lines: Record<string, unknown>[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _enc, done) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  const streams = () =>
    multistream([{ level: 'trace' as const, stream: sink }]);
  const root = new RootLoggerWrapper(
    pino(
      { level: 'info', customLevels: { http: 25, http_out: 15 } },
      streams(),
    ) as Logger,
  );
  return { root, lines, streams };
}

describe('RootLoggerWrapper.child', () => {
  it('keeps per-instance bindings for loggers that share a class name', () => {
    const { root, lines } = createRoot();

    const first = root.child({ className: 'HlsSession', sessionId: 'a' });
    const second = root.child({ className: 'HlsSession', sessionId: 'b' });
    first.logger.info('first');
    second.logger.info('second');

    expect(lines.map((line) => [line.msg, line.sessionId])).toEqual([
      ['first', 'a'],
      ['second', 'b'],
    ]);
  });

  it('keeps per-instance bindings under a log category', () => {
    const { root, lines } = createRoot();

    root
      .child({ className: 'Tracker', category: 'streaming', id: 'a' })
      .logger.info('first');
    root
      .child({ className: 'Tracker', category: 'streaming', id: 'b' })
      .logger.info('second');

    expect(lines.map((line) => line.id)).toEqual(['a', 'b']);
  });

  it('returns the cached class logger when there are no extra bindings', () => {
    const { root } = createRoot();

    const first = root.child({ className: 'Scheduler', worker: undefined });
    const second = root.child({ className: 'Scheduler' });

    expect(second).toBe(first);
  });

  it('applies runtime level changes to per-instance loggers', () => {
    const { root, lines, streams } = createRoot();
    const instance = root.child({ className: 'HlsSession', sessionId: 'a' });

    instance.logger.debug('before');
    root.updateLevel('debug', streams());
    instance.logger.debug('after');

    expect(instance.logger.level).toBe('debug');
    expect(lines.map((line) => line.msg)).toEqual(['after']);
  });
});
