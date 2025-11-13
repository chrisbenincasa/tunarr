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
import { Box, Paper } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { isStructuralItemType, isTerminalItemType } from '@tunarr/types';
import { Route } from '../../routes/media_/$programType.$programId.tsx';

export const ProgramPage = () => {
  const { programId, programType } = Route.useParams();

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
    enabled:
      !isTerminalItemType(programType) && !isStructuralItemType(programType),
  });

  const programData = query?.data || parentQuery?.data;
  const isLoading = query.isLoading || parentQuery.isLoading;

  return (
    !isLoading &&
    programData && (
      <Box
        component={Paper}
        sx={{
          padding: 5,
        }}
      >
        <MediaDetailCard program={programData} />
        {programType === 'show' && <Seasons program={programData} />}
        {programType === 'season' && <Episodes program={programData} />}
        {programType === 'artist' && <Albums program={programData} />}
        {programType === 'album' && <Tracks program={programData} />}
        <Actors program={programData} />
      </Box>
    )
  );
};
