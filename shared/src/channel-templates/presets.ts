import { randomUUID } from 'node:crypto';
import type { ChannelPreset } from '@tunarr/types/api';

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
        smartCollectionId: '00000000-0000-0000-0000-000000000000', // Placeholder, resolved at creation time
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
        smartCollectionId: '00000000-0000-0000-0000-000000000000', // Placeholder, resolved at creation time
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

export const BuiltInPresets: ChannelPreset[] = [
  ShufflePreset,
  MovieChannelPreset,
];

export function getPresetById(id: string): ChannelPreset | undefined {
  return BuiltInPresets.find((p) => p.id === id);
}
