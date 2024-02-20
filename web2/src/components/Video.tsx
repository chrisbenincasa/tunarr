import Hls from 'hls.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { apiClient } from '../external/api.ts';
import { useHls } from '../hooks/useHls.ts';

type VideoProps = {
  channelNumber: number;
};

export default function Video({ channelNumber }: VideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { hls, resetHls } = useHls();
  const hlsSupported = useMemo(() => Hls.isSupported(), []);
  const [loadedStream, setLoadedStream] = useState(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname,
  );

  // Unload HLS when navigating away
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (videoRef.current) {
        console.log('Pause');
        videoRef.current.pause();
      }
      if (hls) {
        console.log('stopping playback');
        hls.detachMedia();
        hls.destroy();
      }
      blocker.proceed();
    }
  }, [blocker, hls, videoRef]);

  useEffect(() => {
    console.info('Loading stream...');
    const video = videoRef.current;
    if (video && hls && !loadedStream) {
      setLoadedStream(true);
      apiClient
        .startHlsStream({ params: { channelNumber } })
        .then(({ streamPath }) => {
          console.log('Got stream', streamPath, hls);
          hls.loadSource(`http://localhost:8000${streamPath}`);
          hls.attachMedia(video);
        })
        .catch((err) => {
          console.error('Unable to fetch stream URL', err);
          setLoadedStream(false);
        });
    }
  }, [videoRef, hls, loadedStream, channelNumber]);

  useEffect(() => {
    console.log('channel number change, reload');
    resetHls();
    setLoadedStream(false);
  }, [channelNumber, resetHls]);

  return !hlsSupported ? (
    <div>HLS not supported in this browser!</div>
  ) : (
    <div>
      <video style={{ width: '1080px' }} controls autoPlay ref={videoRef} />
    </div>
  );
}
