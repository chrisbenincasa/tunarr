import type { Adapter } from 'lowdb';
import { z } from 'zod/v4';
import { SchemaBackedDbAdapter } from './SchemaBackedJsonDBAdapter.ts';

const LineupSchema = z.object({
  items: z.array(z.object({ id: z.string() })),
  startTimeOffsets: z.array(z.number()),
});

type Lineup = z.output<typeof LineupSchema>;

const emptyLineup: Lineup = { items: [], startTimeOffsets: [] };

const populatedLineup: Lineup = {
  items: [{ id: 'program-1' }, { id: 'program-2' }],
  startTimeOffsets: [0, 1000],
};

/**
 * An in-memory stand-in for lowdb's TextFile. Mirrors its contract exactly:
 * `read` resolves null when the file does not exist, and rejects for any other
 * failure. That distinction is the whole subject of these tests.
 */
class FakeTextFile implements Adapter<string> {
  writes: string[] = [];
  #readError: Error | undefined;

  constructor(private contents: string | null) {}

  failReadsWith(error: Error) {
    this.#readError = error;
    return this;
  }

  read(): Promise<string | null> {
    if (this.#readError !== undefined) {
      return Promise.reject(this.#readError);
    }
    return Promise.resolve(this.contents);
  }

  write(str: string): Promise<void> {
    this.writes.push(str);
    this.contents = str;
    return Promise.resolve();
  }
}

const ioError = () =>
  Object.assign(new Error('EIO: i/o error'), { code: 'EIO' });

test('reads through the adapter it was given', async () => {
  const file = new FakeTextFile(JSON.stringify(populatedLineup));
  const subject = new SchemaBackedDbAdapter(
    LineupSchema,
    '/does/not/exist.json',
    emptyLineup,
    file,
  );

  await expect(subject.read()).resolves.toEqual(populatedLineup);
});

test('does not overwrite the file when the read fails', async () => {
  const onDisk = JSON.stringify(populatedLineup);
  const file = new FakeTextFile(onDisk).failReadsWith(ioError());
  const subject = new SchemaBackedDbAdapter(
    LineupSchema,
    '/lineup.json',
    emptyLineup,
    file,
  );

  await subject.read().catch(() => null);

  expect(file.writes).toEqual([]);
});

test('surfaces the read failure to the caller instead of returning defaults', async () => {
  const file = new FakeTextFile(JSON.stringify(populatedLineup)).failReadsWith(
    ioError(),
  );
  const subject = new SchemaBackedDbAdapter(
    LineupSchema,
    '/lineup.json',
    emptyLineup,
    file,
  );

  await expect(subject.read()).rejects.toThrow(/EIO/);
});

test('initializes an absent file from the defaults', async () => {
  const file = new FakeTextFile(null);
  const subject = new SchemaBackedDbAdapter(
    LineupSchema,
    '/lineup.json',
    emptyLineup,
    file,
  );

  await expect(subject.read()).resolves.toEqual(emptyLineup);
  expect(file.writes).toHaveLength(1);
});

test('leaves a valid file untouched', async () => {
  const file = new FakeTextFile(JSON.stringify(populatedLineup));
  const subject = new SchemaBackedDbAdapter(
    LineupSchema,
    '/lineup.json',
    emptyLineup,
    file,
  );

  await expect(subject.read()).resolves.toEqual(populatedLineup);
  expect(file.writes).toEqual([]);
});

test('repairs a file that is missing fields by merging the defaults in', async () => {
  const file = new FakeTextFile(
    JSON.stringify({ items: [{ id: 'program-1' }] }),
  );
  const subject = new SchemaBackedDbAdapter(
    LineupSchema,
    '/lineup.json',
    emptyLineup,
    file,
  );

  await expect(subject.read()).resolves.toEqual({
    items: [{ id: 'program-1' }],
    startTimeOffsets: [],
  });
  expect(file.writes).toHaveLength(1);
});

describe('damaged files', () => {
  test.each(['', ' \n'])(
    'treats a file holding %j as missing',
    async (contents) => {
      const file = new FakeTextFile(contents);
      const subject = new SchemaBackedDbAdapter(
        LineupSchema,
        '/lineup.json',
        emptyLineup,
        file,
      );

      await expect(subject.read()).resolves.toEqual(emptyLineup);
      expect(file.writes).toHaveLength(1);
    },
  );

  test('throws an error that names the file by default', async () => {
    const file = new FakeTextFile('{"truncated":');
    const subject = new SchemaBackedDbAdapter(
      LineupSchema,
      '/lineup.json',
      emptyLineup,
      file,
    );

    await expect(subject.read()).rejects.toThrow(
      '/lineup.json does not contain valid JSON',
    );
    expect(file.writes).toEqual([]);
  });

  test('moves an invalid file aside and logs both paths', async () => {
    const file = new FakeTextFile('{"truncated":');
    const rename = vi.fn(() => Promise.resolve());
    const subject = new SchemaBackedDbAdapter(
      LineupSchema,
      '/settings.json',
      emptyLineup,
      file,
      { invalidJson: 'move_aside', now: () => 123, rename },
    );
    const logError = vi.spyOn(subject['logger'], 'error');

    await expect(subject.read()).resolves.toEqual(emptyLineup);

    expect(rename).toHaveBeenCalledWith(
      '/settings.json',
      '/settings.json.corrupt-123',
    );
    expect(logError).toHaveBeenCalledWith(
      expect.any(SyntaxError),
      expect.any(String),
      '/settings.json',
      '/settings.json.corrupt-123',
    );
    expect(file.writes).toHaveLength(1);
  });

  test('leaves an invalid file alone when told to ignore it', async () => {
    const file = new FakeTextFile('{"truncated":');
    const rename = vi.fn(() => Promise.resolve());
    const subject = new SchemaBackedDbAdapter(
      LineupSchema,
      '/settings.json',
      emptyLineup,
      file,
      { invalidJson: 'ignore', rename },
    );

    await expect(subject.read()).resolves.toBeNull();
    expect(rename).not.toHaveBeenCalled();
    expect(file.writes).toEqual([]);
  });
});
