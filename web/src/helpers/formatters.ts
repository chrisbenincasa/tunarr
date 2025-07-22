import type { ChannelProgram } from '@tunarr/types';
import { match } from 'ts-pattern';

export function programTitle(program: ChannelProgram): string {
  return match(program)
    .with({ type: 'content', subtype: 'movie' }, (p) => p.title)
    .with({ type: 'content' }, (p) => p.grandparent?.title ?? p.title)
    .with({ type: 'custom' }, (p) => p.program?.title ?? 'Custom Program')
    .with({ type: 'redirect' }, (p) => `Redirect to Channel ${p.channel}`)
    .with({ type: 'flex' }, () => 'Flex')
    .with({ type: 'filler' }, (f) => f.program?.title ?? 'Filler Program')
    .exhaustive();
}
