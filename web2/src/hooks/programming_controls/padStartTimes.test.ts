import { ChannelProgram } from '@tunarr/types';
import { test } from 'vitest';
import { padStartTimes } from './usePadStartTimes.ts';

test('should first', () => {
  const programs: ChannelProgram[] = [
    {
      persisted: true,
      duration: 3137953,
      icon: '',
      type: 'flex',
    },
    {
      persisted: true,
      duration: 2509664,
      icon: '/library/metadata/21350/thumb/1702893554',
      type: 'content',
      subtype: 'episode',
      id: '581f73f0-6bd6-4d95-9fb5-d13e019abba0',
      summary:
        'Four college students are found stabbed to death in their home. Police say the suspect had studied the criminal mind. "48 Hours" correspondent Peter Van Sant reports.',
      date: '2023-01-07',
      rating: 'TV-14',
      title: '48 Hours',
      episodeTitle: 'The Idaho Student Murders',
      episodeNumber: 13,
    },
    {
      persisted: true,
      duration: 1321820,
      icon: '/library/metadata/17237/thumb/1702975805',
      type: 'content',
      subtype: 'episode',
      id: 'ad955562-49ac-4594-90ad-94c678ba7d1a',
      summary:
        'Liz Lemon is the head writer on a demanding, live TV program in New York City. However, things begin to get complicated when her new boss insists that a wild and unpredictable movie star joins the cast.',
      date: '2006-10-11',
      rating: 'TV-14',
      title: '30 Rock',
      episodeTitle: 'Pilot',
      episodeNumber: 1,
    },
  ];
  console.log(
    padStartTimes(undefined, programs, { mod: -1, description: 'x' }),
  );
});
