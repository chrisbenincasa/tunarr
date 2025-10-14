import { Stack, Typography } from '@mui/material';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useMediaSource } from '../../hooks/media-sources/mediaSourceHooks.ts';
import { ProgramViewToggleButton } from '../base/ProgramViewToggleButton.tsx';
import Breadcrumbs from '../Breadcrumbs.tsx';
import { LibraryProgramGrid } from './LibraryProgramGrid.tsx';

type Props = {
  mediaSourceId: string;
  libraryId?: string;
};

export const LibraryBrowser = ({ mediaSourceId, libraryId }: Props) => {
  const { data: mediaSource } = useMediaSource(mediaSourceId);

  const library = isNonEmptyString(libraryId)
    ? mediaSource.libraries.find((lib) => lib.id === libraryId)
    : undefined;

  return (
    <Stack gap={2}>
      <Breadcrumbs />
      <Stack direction="row">
        <Typography variant="subtitle2">
          Search is currently scoped to media source "{mediaSource.name}"{' '}
          {library ? `and library "${library.name}"` : ''}
        </Typography>
        <ProgramViewToggleButton sx={{ ml: 'auto' }} />
      </Stack>
      <LibraryProgramGrid
        mediaSource={mediaSource}
        library={library}
        disableProgramSelection
      />
    </Stack>
  );
};
