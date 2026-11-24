import { Trans } from '@lingui/react/macro';
import { Link } from '@mui/material';
import type { MediaSourceSettings } from '@tunarr/types';
import { MonoText } from '../../ui/MonoText.tsx';

// A remote source's URL, or a local source's first folder.
export const MediaSourceLocation = ({
  source,
}: {
  source: MediaSourceSettings;
}) => {
  if (source.type === 'local') {
    const more = source.paths.length - 1;
    return (
      <>
        <MonoText sx={{ overflowWrap: 'anywhere' }}>{source.paths[0]}</MonoText>
        {more > 0 && (
          <>
            {' '}
            <Trans>+{more} more</Trans>
          </>
        )}
      </>
    );
  }

  return (
    <Link
      href={source.uri}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      sx={{ overflowWrap: 'anywhere' }}
    >
      <MonoText>{source.uri}</MonoText>
    </Link>
  );
};
