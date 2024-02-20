import { Button } from '@mui/material';
import Hls from 'hls.js';
import { useCallback, useEffect, useRef } from 'react';
import { apiClient } from '../external/api.ts';

export default function Video() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const hls = hlsRef.current;
    if (hls) {
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('HLS error', data);
      });
    }
  }, [hlsRef]);

  useEffect(() => {
    const hls = hlsRef.current;
    const video = videoRef.current;
    if (hls && video && !hls.media) {
      hls.attachMedia(video);
    }
  }, [hlsRef, videoRef]);

  const loadHls = useCallback(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (video && hls) {
      apiClient
        .startHlsStream({ params: { channelNumber: 1 } })
        .then(({ streamPath }) => {
          hls.loadSource(`http://localhost:8000${streamPath}`);
          if (!hls.media) {
            hls.attachMedia(video);
          }
          video.play().catch(console.error);
        })
        .catch((err) => console.error('Unable to fetch stream URL', err));
    }
  }, [videoRef, hlsRef]);

  if (!Hls.isSupported()) {
    return (
      <div>
        HLS not supported in this browser - we won't be able to play streams.
      </div>
    );
  } else {
    hlsRef.current = new Hls({
      progressive: true,
      fragLoadingTimeOut: 30000,
      initialLiveManifestSize: 3, // About 10 seconds of playback needed before playing
      enableWorker: true,
      lowLatencyMode: true,
      xhrSetup: (xhr) => {
        xhr.setRequestHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Accept, X-Requested-With',
        );
        xhr.setRequestHeader(
          'Access-Control-Allow-Origin',
          'http://localhost:5173',
        );
      },
    });
  }

  return (
    <div>
      <Button onClick={loadHls}>Load HLS</Button>
      <video style={{ width: '1080px' }} controls ref={videoRef} />
    </div>
  );
}
