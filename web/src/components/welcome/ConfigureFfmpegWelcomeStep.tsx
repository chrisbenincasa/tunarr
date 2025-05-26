import { Edit } from '@mui/icons-material';
import { Alert, Button, Skeleton, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { useFfmpegInfo } from '../../hooks/useFfmpegInfo.ts';
import { useVersion } from '../../hooks/useVersion.tsx';

export const ConfigureFfmpegWelcomeStep = () => {
  const { data: version, isPending: versionLoading } = useVersion();

  const ffmpegInstalled =
    version && version.ffmpeg !== 'Error' && version.ffmpeg !== 'unknown';

  const { data: ffmpegInfo } = useFfmpegInfo(ffmpegInstalled);

  return (
    <>
      <Typography variant="h6" fontWeight={600} align="left" sx={{ mt: 3 }}>
        Configure FFmpeg
      </Typography>
      <Typography sx={{ mb: 3 }} align="left">
        FFmpeg transcoding is required for some features like channel overlay,
        subtitles, and measures to prevent issues when switching episodes.
      </Typography>

      {versionLoading ? (
        <Skeleton sx={{ width: '100%' }}>
          <Alert />
        </Skeleton>
      ) : ffmpegInstalled ? (
        <Alert variant="filled" severity="success">
          FFmpeg is installed. Detected version {version?.ffmpeg}
        </Alert>
      ) : (
        <>
          <Alert
            variant="filled"
            severity="warning"
            action={
              <Button
                component={Link}
                to={`/settings/ffmpeg`}
                color="inherit"
                startIcon={<Edit />}
              >
                Edit
              </Button>
            }
          >
            FFMPEG is not detected.
          </Alert>
          <Typography sx={{ my: 3 }} align="left">
            If you are confident FFMPEG is installed, you may just need to
            update the executable path in the settings. To do so, simply click
            Edit above to update the path.
          </Typography>
        </>
      )}
    </>
  );
};
