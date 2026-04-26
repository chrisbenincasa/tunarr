import { createFlexProgram } from '@/helpers/util.ts';
import { seq } from '@tunarr/shared/util';
import type { ChannelProgram, ContentProgram } from '@tunarr/types';
import { isEmpty } from 'lodash-es';
import { match, P } from 'ts-pattern';
import {
  extractProgramGrandparent,
  extractProgramParent,
  getEpisodeShowId,
  getTrackArtistId,
} from '../../helpers/programUtil.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export type RemoveProgrammingRequest = {
  showIds?: string[];
  artistIds?: string[];
  movies?: boolean;
  redirectChannels?: string[];
  customShowIds?: string[];
  flex?: boolean;
  specials?: boolean;
  replaceWithFlex?: boolean;
};

export function useRemoveProgramming() {
  const programs = useStore(materializedProgramListSelector);

  return (removeRequest: RemoveProgrammingRequest) => {
    setCurrentLineup(removeProgramming(programs, removeRequest), true);
  };
}

export const removeProgramming = (
  programs: ChannelProgram[],
  request: RemoveProgrammingRequest,
) => {
  const customShowIdsSet = new Set(request.customShowIds ?? []);
  const shouldRemoveCustomShow = (id: string) => {
    if (isEmpty(request.customShowIds)) {
      return false;
    }

    return customShowIdsSet.has(id);
  };

  const redirectIdsSet = new Set(request.redirectChannels ?? []);
  const shouldRemoveRedirect = (id: string) => {
    if (isEmpty(request.redirectChannels)) {
      return false;
    }

    return redirectIdsSet.has(id);
  };

  const showIdsSet = new Set(request.showIds ?? []);
  const artistsSet = new Set(request.artistIds ?? []);
  const shouldRemoveContentProgram = (program: ContentProgram) => {
    return (
      match(program)
        // TODO: Handle these other types separately
        .with(
          { program: { type: P.union('movie', 'music_video', 'other_video') } },
          () => request.movies ?? false,
        )
        .with({ program: P.select({ type: 'episode' }) }, (ep) => {
          const basedOnShow = isEmpty(request.showIds)
            ? false
            : showIdsSet.has(
                getEpisodeShowId(ep) ??
                  extractProgramGrandparent(ep)?.title ??
                  '',
              );
          const basedOnSpecial =
            !!request.specials && extractProgramParent(ep)?.index === 0;
          return basedOnShow || basedOnSpecial;
        })
        .with({ program: P.select({ type: 'track' }) }, (track) => {
          return isEmpty(request.artistIds)
            ? false
            : artistsSet.has(
                getTrackArtistId(track) ??
                  extractProgramGrandparent(track)?.title ??
                  '',
              );
        })
        .exhaustive()
    );
  };

  return seq.collect(programs, (program) => {
    let shouldRemove = false;
    switch (program.type) {
      case 'flex':
        return request.flex === true ? null : program;
      case 'custom':
        shouldRemove = shouldRemoveCustomShow(program.customShowId);
        break;
      case 'redirect':
        shouldRemove = shouldRemoveRedirect(program.channel);
        break;
      case 'content':
        shouldRemove = shouldRemoveContentProgram(program);
        break;
      default:
        break;
    }

    if (!shouldRemove) {
      return program;
    }

    if (request.replaceWithFlex) {
      return createFlexProgram(program.duration);
    }

    return;
  });
};
