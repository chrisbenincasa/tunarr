import { readTestFile } from '../testing/util.ts';
import { MusicVideoNfoParser } from './MusicVideoNfoParser.ts';

describe('MusicVideo NFO parser', () => {
  test('Kodi sample - ABBA', async () => {
    const contents = (await readTestFile('abba_music_video.nfo')).toString(
      'utf-8',
    );
    const result = await new MusicVideoNfoParser().parse(contents);
    expect(result.isSuccess()).toBe(true);

    const output = result.get().musicvideo;
    expect(output).toMatchObject({
      title: 'Dancing Queen',
      artist: ['ABBA'],
      album: 'Arrival',
      genre: ['Pop'],
      year: 1976,
    });
    expect(output.thumb).toHaveLength(2);
    expect(output.plot).toContain('Dancing Queen');
  });

  test('Simple NFO example with minimal data', async () => {
    const contents = (await readTestFile('music_video_2.nfo')).toString(
      'utf-8',
    );
    const result = await new MusicVideoNfoParser().parse(contents);
    expect(result.isSuccess()).toBe(true);

    const output = result.get().musicvideo;
    expect(output).toMatchObject({
      title: 'MORE',
      artist: ['Mark Osborne'],
      album: 'YouTube',
      premiered: '2013-03-03',
      year: 2013,
    });
    expect(output.plot).toContain('Academy Award');
    expect(output.genre).toBeUndefined();
    expect(output.thumb).toBeUndefined();
  });
});
