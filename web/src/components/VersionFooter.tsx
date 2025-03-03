import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useVersion } from '../hooks/useVersion.tsx';

export default function VersionFooter() {
  const {
    isPending: versionPending,
    data: version,
    error: versionError,
  } = useVersion();

  return versionPending ? (
    <Skeleton>
      <Box />
    </Skeleton>
  ) : (
    <Box sx={{ paddingLeft: 2, paddingRight: 2 }}>
      {versionError ? (
        <Typography
          component="p"
          variant="overline"
        >{`Version: unknown`}</Typography>
      ) : (
        <>
          <Typography
            component="p"
            variant="overline"
          >{`Version: ${version.tunarr}`}</Typography>
          <Typography
            component="p"
            variant="overline"
          >{`FFMPEG: ${version.ffmpeg}`}</Typography>
          <Typography
            component="p"
            variant="overline"
          >{`NodeJS: ${version.nodejs}`}</Typography>
        </>
      )}
    </Box>
  );
}
