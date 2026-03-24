import type { ChannelProgram, Episode } from '@tunarr/types';
import { match } from 'ts-pattern';
import { extractProgramGrandparent } from './programUtil.ts';

export function programTitle(program: ChannelProgram): string {
  return match(program)
    .with(
      { type: 'content', program: { type: 'movie' } },
      ({ program }) => program.title,
    )
    .with(
      { type: 'content' },
      ({ program }) =>
        extractProgramGrandparent(program)?.title ?? program.title,
    )
    .with(
      { type: 'custom' },
      (p) => p.program?.program.title ?? 'Custom Program',
    )
    .with({ type: 'redirect' }, (p) => `Redirect to Channel ${p.channel}`)
    .with({ type: 'flex' }, () => 'Flex')
    .with(
      { type: 'filler' },
      (f) => f.program?.program.title ?? 'Filler Program',
    )
    .exhaustive();
}

export function programSeasonAndEpisode(program: Episode) {
  return `S${program.season?.index?.toString().padStart(2, '0')}E${program.episodeNumber?.toString().padStart(2, '0')}`;
}
