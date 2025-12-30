import { readTestFile } from '../testing/util.ts';
import { MusicArtistNfoParser } from './MusicArtistNfoParser.ts';

describe('MusicArtistNfoParser', () => {
  test('basic nfo', async () => {
    const contents = (await readTestFile('billy_joel.nfo')).toString('utf-8');
    const result = await new MusicArtistNfoParser().parse(contents);
    expect(result.isSuccess()).toBe(true);

    const output = result.get().artist;
    expect(output).toMatchObject({
      name: 'Billy Joel',
      musicBrainzArtistID: '64b94289-9474-4d43-8c93-918ccc1920d1',
      sortname: 'Joel, Billy',
      genre: ['Pop/Rock'],
      style: [
        'Album Rock',
        'Contemporary Pop/Rock',
        'Singer/Songwriter',
        'Soft Rock',
        'Keyboard',
      ],
      mood: [
        'Amiable/Good-Natured',
        'Autumnal',
        'Nostalgic',
        'Refined',
        'Acerbic',
        'Bittersweet',
        'Brash',
        'Cynical/Sarcastic',
        'Earnest',
      ],
      born: '1949-05-09',
      formed: '1964',
    });
    expect(output.biography?.length).greaterThan(0);

    expect(output.thumb).toHaveLength(11);
  });
});
