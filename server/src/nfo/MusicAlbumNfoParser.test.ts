import { readTestFile } from '../testing/util.ts';
import { MusicAlbumNfoParser } from './MusicAlbumNfoParser.ts';

describe('MusicAlbumNfoParser', () => {
  test('basic nfo', async () => {
    const contents = (await readTestFile('album1.nfo')).toString('utf-8');
    const result = await new MusicAlbumNfoParser().parse(contents);
    expect(result.isSuccess()).toBe(true);

    const output = result.get().album;
    expect(output).toMatchObject({
      title: 'Greatest Hits, Volume I & Volume II',
      musicbrainzalbumid: '8bd9c465-28bb-37e4-bab5-aad725246bd7',
      musicbrainzreleasegroupid: '4a8f66b9-2ebf-3ebf-bd5e-ad19386e76c0',
      genre: ['Rock'],
      style: ['Rock/Pop'],
      mood: ['Happy'],
      theme: [
        'Affection/Fondness',
        'At the Office',
        'Cool & Cocky',
        'Drinking',
        'Guys Night Out',
        'Hanging Out',
        'Open Road',
        'Partying',
        'TGIF',
      ],
      compilation: false,
      boxset: false,
      releasestatus: 'official',
      releasedate: '1985',
      originalreleasedate: '1985-07-27',
      label: 'Columbia',
    });
  });
});
