import type {
  MediaArtwork,
  TerminalProgram,
  TvGuideProgram,
} from '@tunarr/types';
import { match, P } from 'ts-pattern';
import { DefaultFallbackPicturePath } from './constants.ts';
import { extractProgramGrandparent } from './programUtil.ts';
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

function programArtworkUrl(program: TerminalProgram, backendUri: string) {
  const [id, artworkType, fallbackTypes] = match([
    program,
    extractProgramGrandparent(program),
  ])
    .returnType<[string, MediaArtwork['type'], MediaArtwork['type'][]]>()
    .with([{ type: 'episode' }, P.nonNullable], ([_, show]) => [
      show.uuid,
      'fanart',
      ['poster'],
    ])
    .with([{ type: 'episode' }, P._], ([ep, _]) => [ep.uuid, 'thumbnail', []])
    .with([{ type: 'track' }, P.nonNullable], ([_, artist]) => [
      artist.uuid,
      'banner',
      ['fanart', 'poster'],
    ])
    .with([{ type: 'movie' }, P._], ([movie, _]) => [
      movie.uuid,
      'banner',
      ['fanart', 'poster'],
    ])
    .otherwise(([other, _]) => [other.uuid, 'fanart', ['poster']]);

  return `${backendUri}/api/programs/${id}/artwork/${artworkType}?fallbackArtworkTypes=${fallbackTypes.join(',')}`;
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
    .with({ type: 'content' }, (p) => programArtworkUrl(p.program, backendUri))
    .with({ type: 'custom', program: P.nonNullable }, (p) =>
      programArtworkUrl(p.program.program, backendUri),
    )
    .otherwise(() => channelFlexImageUrl(flexPicture, backendUri));
}
