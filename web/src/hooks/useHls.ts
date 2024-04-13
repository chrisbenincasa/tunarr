import Hls from 'hls.js';
import { useCallback, useEffect, useRef } from 'react';

const hlsSupported = Hls.isSupported();

export const useHls = () => {
  const hlsRef = useRef<Hls | null>(null);

  const refreshHls = () => {
    if (!hlsSupported) {
      return;
    }

    const newHls = new Hls({
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

    newHls.on(Hls.Events.MANIFEST_PARSED, function (_, data) {
      console.debug(
        'manifest loaded, found ' + data.levels.length + ' quality level',
      );
    });

    newHls.on(Hls.Events.ERROR, (_, data) => {
      console.error('HLS error', data);
    });

    newHls.on(Hls.Events.MEDIA_ATTACHED, function () {
      console.debug('video and hls.js are now bound together !');
    });

    hlsRef.current = newHls;
  };

  const resetHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    hlsRef.current = null;
    refreshHls();
  }, []);

  useEffect(() => {
    refreshHls();
  }, []);

  return {
    hls: hlsRef.current,
    resetHls,
  };
};
