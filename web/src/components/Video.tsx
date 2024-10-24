import { Route } from '@/routes/channels_/$channelId/watch.tsx';
import { PlayArrow, Replay } from '@mui/icons-material';
import { Alert, Box } from '@mui/material';
import Button from '@mui/material/Button';
import { useBlocker, useLocation } from '@tanstack/react-router';
import Hls from 'hls.js';
import { isError, isNil } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFfmpegSettings } from '../hooks/settingsHooks.ts';
import { useHls } from '../hooks/useHls.ts';
import { useTunarrApi } from '../hooks/useTunarrApi.ts';
import { useSettings } from '../store/settings/selectors.ts';

type VideoProps = {
  channelId: string;
};

export default function Video({ channelId }: VideoProps) {
  const { backendUri } = useSettings();
  const apiClient = useTunarrApi();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { hls, resetHls } = useHls();
  const hlsSupported = useMemo(() => Hls.isSupported(), []);
  const [loadedStream, setLoadedStream] = useState<boolean | Error>(false);
  const { data: ffmpegSettings, isLoading: ffmpegSettingsLoading } =
    useFfmpegSettings();
  const { noAutoPlay } = Route.useSearch();
  const [manuallyStarted, setManuallyStarted] = useState(false);
  const location = useLocation();

  const autoPlayEnabled = !noAutoPlay;

  const canLoadStream = useMemo(() => {
    const initialized = !isNil(videoRef.current) && !isNil(hls);
    const alreadedLoadedOrError = isError(loadedStream) || loadedStream;
    const validSettings =
      !ffmpegSettingsLoading &&
      !isNil(ffmpegSettings) &&
      !['ac3'].includes(ffmpegSettings.audioEncoder);
    return initialized && !alreadedLoadedOrError && validSettings;
  }, [videoRef, hls, loadedStream, ffmpegSettingsLoading, ffmpegSettings]);

  const [isBlocked, setIsBlocked] = useState(false);

  const blocker = useBlocker({
    condition: isBlocked,
  });

  useEffect(() => {
    setIsBlocked(true);
  }, [location]);

  // Unload HLS when navigating away
  useEffect(() => {
    if (blocker.status === 'blocked') {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (hls) {
        hls.detachMedia();
        hls.destroy();
      }
      blocker.proceed();
    }
  }, [blocker, hls, videoRef]);

  const reloadStream = useCallback(() => {
    resetHls();
    setLoadedStream(false);
  }, [resetHls, setLoadedStream]);

  useEffect(() => {
    const video = videoRef.current;
    if ((autoPlayEnabled || manuallyStarted) && video && hls && canLoadStream) {
      setLoadedStream(true);
      hls.loadSource(`${backendUri}/stream/channels/${channelId}.m3u8`);
      hls.attachMedia(video);
    }
  }, [
    autoPlayEnabled,
    videoRef,
    hls,
    canLoadStream,
    channelId,
    manuallyStarted,
    apiClient,
    backendUri,
  ]);

  useEffect(() => {
    resetHls();
    setLoadedStream(false);
    setManuallyStarted(true);
  }, [channelId, resetHls]);

  const renderVideo = () => {
    if (!hlsSupported) {
      return (
        <Alert severity="error" sx={{ my: 2 }}>
          HLS not supported in this browser!
        </Alert>
      );
    }

    if (!isNil(ffmpegSettings) && ffmpegSettings.audioEncoder === 'ac3') {
      return (
        <Alert severity="warning" sx={{ my: 2 }}>
          Tunarr is currently configured to use the AC3 audio encoder. This
          audio format is not supported by browsers. The resultant stream will
          likely not have audio or will not play at all.
        </Alert>
      );
    }

    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ width: '100%' }}>
          <video style={{ width: '100%' }} controls autoPlay ref={videoRef} />
        </Box>
        <Button
          variant="contained"
          onClick={() => reloadStream()}
          startIcon={loadedStream ? <Replay /> : <PlayArrow />}
        >
          {loadedStream ? 'Reload' : 'Load'} Stream
        </Button>
      </Box>
    );
  };

  return <Box>{renderVideo()}</Box>;
}
