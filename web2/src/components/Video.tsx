import { Button } from '@mui/material';
import Hls from 'hls.js';
import { useCallback, useRef } from 'react';

export default function Video() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const loadHls = useCallback(() => {
    if (videoRef.current) {
      console.log('callback initiated HLS');
      const hls = new Hls({
        progressive: true,
        fragLoadingTimeOut: 30000,
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
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('video and hls.js are now connected');
      });
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        console.log(
          'manifest loaded, found ' + data.levels.length + ' quality level',
        );
        videoRef.current
          ?.play()
          .then(() => {
            console.log('started video playback');
          })
          .catch((e) => {
            console.error('error while starting video playback', e);
          });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('HLS error', data);
      });
      hls.loadSource('http://localhost:8000/media-player/1.m3u');
      hls.attachMedia(videoRef.current);
      // videoRef.current
      //   .play()
      //   .catch((e) => console.error('Video playback failed', e));
    }
  }, [videoRef]);

  if (!Hls.isSupported()) {
    return (
      <div>
        HLS not supported in this browser - we won't be able to play streams.
      </div>
    );
  }

  return (
    <div>
      <Button onClick={loadHls}>Load HLS</Button>
      <video style={{ width: '50%' }} controls ref={videoRef} />
    </div>
  );
}
