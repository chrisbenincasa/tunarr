import dayjs from 'dayjs';
import fs from 'node:fs/promises';
import { HlsPlaylistMutator } from './HlsPlaylistMutator';

test('HlsPlaylistMutator', async () => {
  const mutator = new HlsPlaylistMutator();
  const lines = (
    await fs.readFile(
      '/home/christian/Code/tunarr/server/streams/stream_46c8a5c7-a09f-43d2-bf35-2f211f9165b2/stream.m3u8',
    )
  )
    .toString('utf-8')
    .split('\n');
  const start = dayjs('2024-09-17T10:18:57.869-0400');
  console.log(start.format());
  const newPlaylist = mutator.trimPlaylist(
    start,
    start.add(45, 'seconds').subtract(1, 'minute'),
    lines,
    10,
    true,
  );
  console.log(newPlaylist?.playlist);
});
