import { randomUUID } from 'node:crypto';
import type { ChannelPreset, ScheduleSkeleton } from '@tunarr/types/api';

function makeShuffleScheduleConfig(
  role: string,
  opts?: { padMs?: number; order?: string; padStyle?: string },
): ScheduleSkeleton {
  return {
    type: 'random',
    flexPreference: 'end',
    maxDays: 30,
    padMs: opts?.padMs ?? 0,
    padStyle: (opts?.padStyle as 'episode' | 'slot') ?? 'episode',
    slots: [
      {
        id: randomUUID(),
        type: 'smart-collection',
        smartCollectionId: role,
        order: (opts?.order as 'shuffle' | 'next') ?? 'shuffle',
        direction: 'asc',
        cooldownMs: 0,
        weight: 1,
        durationSpec: {
          type: 'dynamic',
          programCount: 1,
        },
      },
    ],
    randomDistribution: 'uniform',
    lockWeights: false,
  };
}

export const ShufflePreset: ChannelPreset = {
  id: '24-7-shuffle',
  name: '24/7 Shuffle',
  description:
    'Shuffles all matching content continuously. The simplest channel type.',
  category: 'simple',
  contentRequirements: [
    {
      role: 'all',
      label: 'All Content',
      description: 'All content that will be shuffled on this channel.',
      defaultQuery: {},
      required: true,
      minPrograms: 1,
    },
  ],
  scheduleType: 'random',
  scheduleConfig: {
    type: 'random',
    flexPreference: 'end',
    maxDays: 30,
    padMs: 0,
    padStyle: 'episode',
    slots: [
      {
        id: randomUUID(),
        type: 'smart-collection',
        smartCollectionId: 'all', // Placeholder role name, resolved at creation time
        order: 'shuffle',
        direction: 'asc',
        cooldownMs: 0,
        weight: 1,
        durationSpec: {
          type: 'dynamic',
          programCount: 1,
        },
      },
    ],
    randomDistribution: 'uniform',
    lockWeights: false,
  },
};

export const MovieChannelPreset: ChannelPreset = {
  id: 'movie-channel',
  name: 'Movie Channel',
  description:
    'A channel that plays movies continuously with optional fillers between them.',
  category: 'movie',
  contentRequirements: [
    {
      role: 'movies',
      label: 'Movies',
      description: 'Movies to play on this channel.',
      defaultQuery: {
        programTypes: ['movie'],
      },
      required: true,
      minPrograms: 1,
    },
  ],
  scheduleType: 'random',
  scheduleConfig: {
    type: 'random',
    flexPreference: 'end',
    maxDays: 30,
    padMs: 30 * 60 * 1000, // 30-min pad alignment
    padStyle: 'slot',
    slots: [
      {
        id: randomUUID(),
        type: 'smart-collection',
        smartCollectionId: 'movies', // Placeholder role name, resolved at creation time
        order: 'shuffle',
        direction: 'asc',
        cooldownMs: 0,
        weight: 1,
        durationSpec: {
          type: 'dynamic',
          programCount: 1,
        },
      },
    ],
    randomDistribution: 'uniform',
    lockWeights: false,
  },
};

export const BingePreset: ChannelPreset = {
  id: 'binge-channel',
  name: 'Binge Channel',
  description:
    'Plays a single show in order, episode after episode. Pick a show and binge it.',
  category: 'binge',
  contentRequirements: [
    {
      role: 'show',
      label: 'Show',
      description: 'The show to binge watch.',
      defaultQuery: { programTypes: ['episode'] },
      required: true,
      minPrograms: 1,
      pickerHint: { type: 'single-show', label: 'Choose a show' },
    },
  ],
  scheduleType: 'random',
  scheduleConfig: makeShuffleScheduleConfig('show', { order: 'next' }),
};

export const GenrePreset: ChannelPreset = {
  id: 'genre-channel',
  name: 'Genre Channel',
  description:
    'A channel dedicated to a single genre. Pick Comedy, Action, Horror, or any genre you like.',
  category: 'genre',
  contentRequirements: [
    {
      role: 'content',
      label: 'Content',
      description: 'Content matching your chosen genre.',
      defaultQuery: {},
      required: true,
      minPrograms: 1,
      pickerHint: { type: 'facet', facetFields: ['genre'], label: 'Pick a genre' },
    },
  ],
  scheduleType: 'random',
  scheduleConfig: makeShuffleScheduleConfig('content'),
};

export const ActorDirectorPreset: ChannelPreset = {
  id: 'actor-director-channel',
  name: 'Actor / Director Channel',
  description:
    'A channel featuring content from a specific actor or director.',
  category: 'people',
  contentRequirements: [
    {
      role: 'content',
      label: 'Content',
      description: 'Content featuring your chosen actor or director.',
      defaultQuery: {},
      required: true,
      minPrograms: 1,
      pickerHint: {
        type: 'facet',
        facetFields: ['actor', 'director'],
        label: 'Pick an actor or director',
      },
    },
  ],
  scheduleType: 'random',
  scheduleConfig: makeShuffleScheduleConfig('content'),
};

export const DecadePreset: ChannelPreset = {
  id: 'decade-channel',
  name: 'Decade Channel',
  description:
    'A channel playing content from a specific decade — 80s, 90s, 2000s, and more.',
  category: 'decade',
  contentRequirements: [
    {
      role: 'content',
      label: 'Content',
      description: 'Content from your chosen decade.',
      defaultQuery: {},
      required: true,
      minPrograms: 1,
      pickerHint: { type: 'year-range', label: 'Pick a decade' },
    },
  ],
  scheduleType: 'random',
  scheduleConfig: makeShuffleScheduleConfig('content'),
};

export const NetworkPreset: ChannelPreset = {
  id: 'network-channel',
  name: 'Network Channel',
  description:
    'Recreate a TV network or studio channel — HBO, NBC, A24, and more.',
  category: 'network',
  contentRequirements: [
    {
      role: 'content',
      label: 'Content',
      description: 'Content from your chosen network or studio.',
      defaultQuery: {},
      required: true,
      minPrograms: 1,
      pickerHint: {
        type: 'facet',
        facetFields: ['studio'],
        label: 'Pick a network or studio',
      },
    },
  ],
  scheduleType: 'random',
  scheduleConfig: makeShuffleScheduleConfig('content'),
};

export const WeightedMixPreset: ChannelPreset = {
  id: 'weighted-mix',
  name: 'Weighted Mix',
  description:
    'Mix multiple content groups with custom weights. More weight means more airtime.',
  category: 'custom',
  dynamicRequirements: true,
  minBlocks: 2,
  maxBlocks: 10,
  defaultBlocks: 3,
  contentRequirements: [
    {
      role: 'group_1',
      label: 'Group 1',
      defaultQuery: {},
      required: true,
      minPrograms: 1,
      pickerHint: { type: 'weighted_mix', label: 'Build your mix' },
    },
  ],
  scheduleType: 'random',
  // Placeholder — server builds actual schedule from dynamicParams
  scheduleConfig: makeShuffleScheduleConfig('group_1'),
};

export const ClassicTvDayPreset: ChannelPreset = {
  id: 'classic-tv-day',
  name: 'Classic TV Day',
  description:
    'Build a structured TV day with time blocks — morning cartoons, afternoon soaps, primetime dramas.',
  category: 'classic-tv',
  dynamicRequirements: true,
  minBlocks: 2,
  maxBlocks: 8,
  defaultBlocks: 4,
  contentRequirements: [
    {
      role: 'morning',
      label: 'Morning',
      defaultQuery: {},
      required: true,
      minPrograms: 0,
      pickerHint: { type: 'classic_tv', label: 'Morning' },
    },
    {
      role: 'afternoon',
      label: 'Afternoon',
      defaultQuery: {},
      required: true,
      minPrograms: 0,
      pickerHint: { type: 'classic_tv', label: 'Afternoon' },
    },
    {
      role: 'primetime',
      label: 'Primetime',
      defaultQuery: {},
      required: true,
      minPrograms: 0,
      pickerHint: { type: 'classic_tv', label: 'Primetime' },
    },
    {
      role: 'latenight',
      label: 'Late Night',
      defaultQuery: {},
      required: true,
      minPrograms: 0,
      pickerHint: { type: 'classic_tv', label: 'Late Night' },
    },
  ],
  scheduleType: 'time',
  // Placeholder — server builds actual schedule from dynamicParams
  scheduleConfig: {
    type: 'time',
    flexPreference: 'end',
    maxDays: 30,
    period: 'day',
    padMs: 0,
    latenessMs: 900000,
    timeZoneOffset: 0,
    slots: [
      {
        id: randomUUID(),
        type: 'smart-collection',
        smartCollectionId: 'morning',
        order: 'shuffle',
        direction: 'asc',
        startTime: 6 * 60 * 60 * 1000, // 6 AM
      },
      {
        id: randomUUID(),
        type: 'smart-collection',
        smartCollectionId: 'afternoon',
        order: 'shuffle',
        direction: 'asc',
        startTime: 12 * 60 * 60 * 1000, // 12 PM
      },
      {
        id: randomUUID(),
        type: 'smart-collection',
        smartCollectionId: 'primetime',
        order: 'shuffle',
        direction: 'asc',
        startTime: 20 * 60 * 60 * 1000, // 8 PM
      },
      {
        id: randomUUID(),
        type: 'smart-collection',
        smartCollectionId: 'latenight',
        order: 'shuffle',
        direction: 'asc',
        startTime: 23 * 60 * 60 * 1000, // 11 PM
      },
    ],
  },
};

export const BuiltInPresets: ChannelPreset[] = [
  ShufflePreset,
  MovieChannelPreset,
  BingePreset,
  GenrePreset,
  ActorDirectorPreset,
  DecadePreset,
  NetworkPreset,
  WeightedMixPreset,
  ClassicTvDayPreset,
];

export function getPresetById(id: string): ChannelPreset | undefined {
  return BuiltInPresets.find((p) => p.id === id);
}
