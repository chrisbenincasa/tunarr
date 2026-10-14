import { Container } from 'inversify';
import { describe, expect, test } from 'vitest';
import { KEYS } from '../types/inject.ts';
import { ChannelLineupLock } from './ChannelLineupLock.ts';

const channelA = 'channel-a';
const channelB = 'channel-b';

function tick(ms = 0) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe('ChannelLineupLock', () => {
  test('serializes two read-modify-writes of one channel', async () => {
    const lock = new ChannelLineupLock();
    let stored = 0;

    const increment = () =>
      lock.run(channelA, async () => {
        const read = stored;
        await tick(5);
        stored = read + 1;
      });

    await Promise.all([increment(), increment(), increment()]);

    expect(stored).toBe(3);
  });

  test('lets different channels run at the same time', async () => {
    const lock = new ChannelLineupLock();
    const order: string[] = [];

    const a = lock.run(channelA, async () => {
      order.push('a-start');
      await tick(20);
      order.push('a-end');
    });
    const b = lock.run(channelB, async () => {
      order.push('b-start');
      await tick(0);
      order.push('b-end');
    });

    await Promise.all([a, b]);

    expect(order).toEqual(['a-start', 'b-start', 'b-end', 'a-end']);
  });

  test('a nested run of the same channel passes straight through', async () => {
    const lock = new ChannelLineupLock();

    const result = await lock.run(channelA, async () => {
      await tick(0);
      return lock.run(channelA, async () => {
        await tick(0);
        return lock.run(channelA, () => Promise.resolve('done'));
      });
    });

    expect(result).toBe('done');
    expect(lock.isLocked(channelA)).toBe(false);
  });

  test('a nested run of another channel still takes that lock', async () => {
    const lock = new ChannelLineupLock();
    let blockedStarted = false;

    const outer = lock.run(channelA, async () => {
      // B is held by the caller below, so this waits for it.
      await lock.run(channelB, async () => {
        blockedStarted = true;
        await tick(0);
      });
    });

    const holdB = lock.run(channelB, async () => {
      await tick(20);
      expect(blockedStarted).toBe(false);
    });

    await Promise.all([outer, holdB]);

    expect(blockedStarted).toBe(true);
  });

  test('holding one channel does not make an unrelated caller reentrant', async () => {
    const lock = new ChannelLineupLock();
    const order: string[] = [];

    const held = lock.run(channelA, async () => {
      order.push('held-start');
      await tick(20);
      order.push('held-end');
    });
    await tick(0);

    const waiting = lock.run(channelA, () => {
      order.push('waiting');
      return Promise.resolve();
    });

    await Promise.all([held, waiting]);

    expect(order).toEqual(['held-start', 'held-end', 'waiting']);
  });

  test('a throwing callback releases the lock', async () => {
    const lock = new ChannelLineupLock();

    await expect(
      lock.run(channelA, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    await expect(lock.run(channelA, () => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
  });

  // The lock only serializes callers that share it, and Inversify's default
  // scope is Transient, so every injection site has to resolve the same one.
  test('resolves to one instance under both its class and its key', () => {
    const container = new Container({ autobind: true });
    container.bind(ChannelLineupLock).toSelf().inSingletonScope();
    container.bind(KEYS.ChannelLineupLock).toService(ChannelLineupLock);

    const byClass = container.get(ChannelLineupLock);
    const byKey = container.get<ChannelLineupLock>(KEYS.ChannelLineupLock);

    expect(byClass).toBe(byKey);
    expect(container.get(ChannelLineupLock)).toBe(byClass);
  });
});
