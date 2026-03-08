import Actors from '@/components/programs/Actors.tsx';
import Albums from '@/components/programs/Albums.tsx';
import Episodes from '@/components/programs/Episodes.tsx';
import MediaDetailCard from '@/components/programs/MediaDetailCard.tsx';
import Seasons from '@/components/programs/Seasons.tsx';
import Tracks from '@/components/programs/Tracks.tsx';
import {
  getApiProgramGroupingsByIdOptions,
  getApiProgramsByIdOptions,
} from '@/generated/@tanstack/react-query.gen.ts';
import { Box, Breadcrumbs, Paper } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type {
  ProgramGrouping,
  ProgramLike,
  TerminalProgram,
} from '@tunarr/types';
import { isGroupingItemType, isTerminalItemType } from '@tunarr/types';
import { compact } from 'lodash-es';
import React, { useMemo } from 'react';
import { match, P } from 'ts-pattern';
import { RouterLink } from '../../components/base/RouterLink.tsx';
import { Route } from '../../routes/media_/$programType.$programId.tsx';

function makeLink(program: ProgramLike, active: boolean = false) {
  return (
    <RouterLink
      key={`${program.type}_${program.uuid}`}
      underline="hover"
      color={active ? 'text.primary' : 'inherit'}
      to={`/media/$programType/$programId`}
      params={{ programType: program.type, programId: program.uuid }}
    >
      {program.title}
    </RouterLink>
  );
}

export const ProgramPage = () => {
  const { programId, programType: rawProgramType } = Route.useParams();
  // TODO: Figure out why TS can't deduce this type.
  const programType = rawProgramType as
    | TerminalProgram['type']
    | ProgramGrouping['type'];

  const query = useQuery({
    ...getApiProgramsByIdOptions({
      path: {
        id: programId,
      },
    }),
    enabled: isTerminalItemType(programType),
  });

  const parentQuery = useQuery({
    ...getApiProgramGroupingsByIdOptions({
      path: {
        id: programId,
      },
    }),
    enabled: isGroupingItemType(programType),
  });

  const programData = query?.data ?? parentQuery?.data;
  const isLoading = query.isLoading ?? parentQuery.isLoading;

  const breadcrumbLinks = useMemo(() => {
    return match(programData)
      .returnType<React.ReactElement[]>()
      .with(P.nullish, () => [])
      .with({ type: 'episode' }, (ep) => {
        const show = ep.show ?? ep.season?.show;
        return compact([
          show ? makeLink(show) : null,
          ep.season ? makeLink(ep.season) : null,
          makeLink(ep, true),
        ]);
      })
      .with({ type: 'season' }, (season) =>
        compact([
          season.show ? makeLink(season.show) : null,
          makeLink(season, true),
        ]),
      )
      .with({ type: 'track' }, (track) => {
        const artist = track.artist ?? track.album?.artist;
        return compact([
          artist ? makeLink(artist) : null,
          track.album ? makeLink(track.album) : null,
        ]);
      })
      .with({ type: 'album' }, (album) =>
        compact([
          album.artist ? makeLink(album.artist) : null,
          makeLink(album, true),
        ]),
      )
      .with(
        {
          type: P.union(
            'show',
            'artist',
            'movie',
            'music_video',
            'other_video',
          ),
        },
        () => [],
      )
      .exhaustive();
  }, [programData]);

  return (
    !isLoading &&
    programData && (
      <Box
        component={Paper}
        sx={{
          padding: 5,
        }}
      >
        <Breadcrumbs
          separator="/"
          sx={{
            mb: 2,
          }}
        >
          {...breadcrumbLinks}
        </Breadcrumbs>
        <MediaDetailCard program={programData} />
        {programData?.type === 'show' && <Seasons program={programData} />}
        {programData?.type === 'season' && <Episodes program={programData} />}
        {programData?.type === 'artist' && <Albums program={programData} />}
        {programData?.type === 'album' && <Tracks program={programData} />}
        <Actors program={programData} />
      </Box>
    )
  );
};
