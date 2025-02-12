import { Stack, Typography } from '@mui/material';
import { useMediaSourceLibrary } from '../../hooks/media-sources/mediaSourceLibraryHooks.ts';
import { ProgramViewToggleButton } from '../base/ProgramViewToggleButton.tsx';
import Breadcrumbs from '../Breadcrumbs.tsx';
import { LibraryProgramGrid } from './LibraryProgramGrid.tsx';

type Props = {
  libraryId: string;
};

export const LibraryBrowser = ({ libraryId }: Props) => {
  const { data: library } = useMediaSourceLibrary(libraryId);

  return (
    <Stack gap={2}>
      <Breadcrumbs />
      <Stack direction="row">
        <Typography variant="subtitle2">
          Search is currently scoped to media source "{library.mediaSource.name}
          " library "{library.name}"
        </Typography>
        <ProgramViewToggleButton sx={{ ml: 'auto' }} />
      </Stack>
      <LibraryProgramGrid library={library} disableProgramSelection />
    </Stack>
  );
};
