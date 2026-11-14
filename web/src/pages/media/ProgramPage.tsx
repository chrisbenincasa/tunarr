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

  const breadcrumbLinks = useMemo((): React.ReactElement[] => {
    if (!programData) {
      return [];
    }

    switch (programData.type) {
      case 'episode': {
        const show = programData.show ?? programData.season?.show;
        return compact([
          show ? makeLink(show) : null,
          programData.season ? makeLink(programData.season) : null,
          makeLink(programData, true),
        ]);
      }
      case 'season':
        return compact([
          programData.show ? makeLink(programData.show) : null,
          makeLink(programData, true),
        ]);
      case 'track': {
        const artist = programData.artist ?? programData.album?.artist;
        return compact([
          artist ? makeLink(artist) : null,
          programData.album ? makeLink(programData.album) : null,
        ]);
      }
      case 'album':
        return compact([
          programData.artist ? makeLink(programData.artist) : null,
          makeLink(programData, true),
        ]);
      case 'show':
      case 'artist':
      case 'movie':
      case 'music_video':
      case 'other_video':
        return [];
    }
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
