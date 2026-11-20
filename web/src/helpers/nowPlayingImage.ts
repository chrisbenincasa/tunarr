import type { TvGuideProgram } from '@tunarr/types';
import { match, P } from 'ts-pattern';
import { programArtworkUrl } from '../components/channels/channelSummary.ts';
import { DefaultFallbackPicturePath } from './constants.ts';
import { isNonEmptyString } from './util.ts';

/**
 * The image a channel shows during flex. Matches the stream, which falls
 * back to the generic offline screen when no picture is set.
 */
export function channelFlexImageUrl(
  picture: string | undefined,
  backendUri: string,
): string {
  return isNonEmptyString(picture)
    ? picture
    : `${backendUri}${DefaultFallbackPicturePath}`;
}

/**
 * The image for the program airing now. Programs without artwork of their
 * own (flex, unresolved redirects, custom items missing their program) show
 * the channel's flex image.
 */
export function nowPlayingImageUrl(
  program: TvGuideProgram,
  flexPicture: string | undefined,
  backendUri: string,
): string {
  return match(program)
    .with({ type: 'content' }, (p) => programArtworkUrl(backendUri, p.program))
    .with({ type: 'custom', program: P.nonNullable }, (p) =>
      programArtworkUrl(backendUri, p.program.program),
    )
    .otherwise(() => channelFlexImageUrl(flexPicture, backendUri));
}
