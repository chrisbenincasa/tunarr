import { Stack, Typography } from '@mui/material';
import { useMediaSourceLibrary } from '../../hooks/media-sources/mediaSourceLibraryHooks.ts';
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
      <Typography variant="subtitle2">
        Search is currently scoped to media source "{library.mediaSource.name}"
        library "{library.name}"
      </Typography>
      <LibraryProgramGrid library={library} disableProgramSelection />
    </Stack>
  );
};
