import { useCallback, useEffect, useRef } from 'react';
import { useIsMounted, useUnmount } from 'usehooks-ts';

export const useDownload = () => {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const isMounted = useIsMounted()();

  useEffect(() => {
    if (isMounted && !ref.current) {
      console.log('hello');
      ref.current = document.createElement('a');
      ref.current.id = 'download-thing';
      ref.current.style.display = 'none';

      const out = document.body.appendChild(ref.current);
      console.log(out);
    }
  }, [isMounted]);

  useUnmount(() => {
    ref.current?.remove();
  });

  return useCallback((data: BlobPart, filename: string, mimetype?: string) => {
    if (!ref.current) {
      return;
    }
    const blob = new Blob([data], {
      type: mimetype ?? 'application/octet-stream',
    });
    const blobUrl = window.URL?.createObjectURL
      ? window.URL.createObjectURL(blob)
      : window.webkitURL.createObjectURL(blob);

    ref.current.href = blobUrl;
    ref.current.setAttribute('download', filename);

    ref.current.click();

    setTimeout(() => {
      if (window.URL?.revokeObjectURL) {
        window.URL.revokeObjectURL(blobUrl);
      } else {
        window.webkitURL.revokeObjectURL(blobUrl);
      }
    });
  }, []);
};
