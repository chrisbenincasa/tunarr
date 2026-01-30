import { seq } from './index.js';

describe('seq', () => {
  test('collect takes a type predicate', () => {
    const pred = (n: number): n is 1 => n === 1;
    const out = seq.collect([1, 2, 3], pred);
    expect(out).toEqual([1]);
  });

  test('invert', () => {
    const virtualFieldToIndexField: Record<string, string> = {
      genre: 'genres.name',
      actor: 'actors.name',
      writer: 'writer.name',
      director: 'director.name',
      studio: 'studio.name',
      year: 'originalReleaseYear',
      release_date: 'originalReleaseDate',
      release_year: 'originalReleaseYear',
      minutes: 'duration',
      seconds: 'duration',
      show_genre: 'grandparent.genres',
      show_title: 'grandparent.title',
      show_tags: 'grandparent.tags',
      show_studio: 'grandparent.studio',
      grandparent_genre: 'grandparent.genres',
      video_bit_depth: 'videoBitDepth',
      video_codec: 'videoCodec',
      video_height: 'videoHeight',
      video_width: 'videoWidth',
      audio_language: 'audioLanguages',
      subtitle_language: 'subtitleLanguages',
      audio_codec: 'audioCodec',
      audio_channels: 'audioChannels',
    };

    const result = seq.invert(virtualFieldToIndexField, true);

    expect(result).toEqual({
      'genres.name': ['genre'],
      'actors.name': ['actor'],
      'writer.name': ['writer'],
      'director.name': ['director'],
      'studio.name': ['studio'],
      originalReleaseYear: ['year', 'release_year'],
      originalReleaseDate: ['release_date'],
      duration: ['minutes', 'seconds'],
      'grandparent.genres': ['show_genre', 'grandparent_genre'],
      'grandparent.title': ['show_title'],
      'grandparent.tags': ['show_tags'],
      'grandparent.studio': ['show_studio'],
      videoBitDepth: ['video_bit_depth'],
      videoCodec: ['video_codec'],
      videoHeight: ['video_height'],
      videoWidth: ['video_width'],
      audioLanguages: ['audio_language'],
      subtitleLanguages: ['subtitle_language'],
      audioCodec: ['audio_codec'],
      audioChannels: ['audio_channels'],
    });
  });
});
