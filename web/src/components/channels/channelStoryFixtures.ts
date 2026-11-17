import type { Channel, ChannelSession } from '@tunarr/types';
import type { NowPlayingSummary } from './channelSummary.ts';
import type { TranscodeConfigRef } from './ChannelsView.tsx';

// Story-only fixtures. Nothing in the app imports this file.

const hour = 60 * 60 * 1000;

export const storyTranscodeConfigs: TranscodeConfigRef[] = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Default' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'NVENC 1080p' },
];

const session = (numConnections: number): ChannelSession => ({
  type: 'hls',
  state: 'started',
  numConnections,
  connections: [],
});

export const makeStoryChannel = (
  overrides: Partial<Channel> = {},
): Channel => ({
  id: 'channel-1',
  number: 1,
  name: 'Saturday Morning Cartoons',
  icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
  duration: 206 * hour,
  programCount: 412,
  stealth: false,
  onDemand: { enabled: false },
  streamMode: 'hls',
  transcodeConfigId: storyTranscodeConfigs[0].id,
  streamSelectionProfileId: null,
  disableFillerOverlay: false,
  groupTitle: 'tunarr',
  guideMinimumDuration: 30_000,
  offline: { mode: 'pic' },
  startTime: 0,
  subtitlesEnabled: false,
  useEtvNext: false,
  ...overrides,
});

export const storyChannels: Channel[] = [
  makeStoryChannel({ sessions: [session(2)] }),
  makeStoryChannel({
    id: 'channel-2',
    number: 2,
    name: 'Classic Sitcoms',
    programCount: 1286,
    duration: 434 * hour,
    transcodeConfigId: storyTranscodeConfigs[1].id,
  }),
  makeStoryChannel({
    id: 'channel-3',
    number: 3,
    name: '80s Movie Night',
    programCount: 64,
    duration: 105 * hour,
    streamMode: 'mpegts',
    sessions: [session(0)],
  }),
  makeStoryChannel({
    id: 'channel-4',
    number: 4,
    name: 'Sci-Fi Marathon',
    programCount: 548,
    duration: 414 * hour,
    sessions: [session(1)],
  }),
  makeStoryChannel({
    id: 'channel-7',
    number: 7,
    name: 'Music Videos',
    programCount: 2310,
    duration: 155 * hour,
    stealth: true,
  }),
  makeStoryChannel({
    id: 'channel-12',
    number: 12,
    name: 'Kids Block',
    programCount: 330,
    duration: 121 * hour,
    streamMode: 'mpegts',
    onDemand: { enabled: true },
  }),
];

export const longTextChannel = makeStoryChannel({
  id: 'channel-1024',
  number: 1024,
  name: 'The Extremely Long Saturday Morning Cartoon Marathon Channel',
  programCount: 12_480,
  stealth: true,
  onDemand: { enabled: true },
  sessions: [session(14)],
});

export const storyNowPlaying = new Map<string, NowPlayingSummary>([
  [
    'channel-1',
    {
      kind: 'content',
      title: 'Batman: The Animated Series',
      detail: 'S01E03 · Nothing to Fear',
      code: 'S01E03',
      progress: 0.4,
    },
  ],
  [
    'channel-2',
    {
      kind: 'content',
      title: 'Seinfeld',
      detail: 'S04E11 · The Contest',
      code: 'S04E11',
      progress: 0.52,
    },
  ],
  [
    'channel-3',
    { kind: 'content', title: 'Back to the Future', progress: 0.02 },
  ],
  [
    'channel-4',
    {
      kind: 'content',
      title: 'Star Trek: The Next Generation',
      detail: 'S03E15 · Yesterday’s Enterprise',
      code: 'S03E15',
      progress: 0.6,
    },
  ],
  ['channel-7', { kind: 'flex', title: 'Flex', progress: 0.2 }],
  ['channel-12', { kind: 'redirect', redirectChannel: 4, progress: 0.6 }],
  [
    'channel-1024',
    {
      kind: 'content',
      title:
        'A Remarkably Long Documentary Series Title That Will Not Fit On One Line',
      detail: 'S12E104 · An Equally Long Episode Title For Testing Truncation',
      code: 'S12E104',
      progress: 0.9,
    },
  ],
]);
