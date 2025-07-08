import dayjs from 'dayjs';
import { readTestFile } from '../../testing/util.ts';
import { HlsPlaylistMutator } from './HlsPlaylistMutator.ts';

test('HlsPlaylistMutator', async () => {
  const mutator = new HlsPlaylistMutator();
  const lines = (await readTestFile('test.m3u8')).toString('utf-8').split('\n');
  const start = dayjs('2024-10-18T14:01:55.164-0400');

  const newPlaylist = mutator.trimPlaylist(
    start,
    start.subtract(30, 'seconds'),
    lines,
    10,
    true,
  );

  console.log(
    mutator.parsePlaylist(start, newPlaylist.playlist.split('\n'), true),
  );
});
