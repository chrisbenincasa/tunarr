import { isNonEmptyString } from '@/helpers/util';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMounted, useUnmount } from 'usehooks-ts';
import { useBrowserInfo } from './useBrowserInfo';

export const useCopyToClipboard = () => {
  const browser = useBrowserInfo();
  const snackbar = useSnackbar();
  const [id] = useState(`value${new Date().getTime()}`);
  const ref = useRef<HTMLDivElement | null>(null);

  const isMounted = useIsMounted()();

  useEffect(() => {
    if (!window.isSecureContext && isMounted) {
      if (!ref.current) {
        const txtarea = document.createElement('div');
        txtarea.setAttribute(
          'style',
          'position:absolute;left:-10000px;top:-10000px',
        );
        txtarea.setAttribute('id', id);
        // txtarea.setAttribute('style', 'display:none');
        document.body.appendChild(txtarea);
        ref.current = txtarea;
      } else if (!ref.current.parentNode) {
        ref.current.setAttribute('id', id);
        document.body.appendChild(ref.current);
      }
    }
  }, [id, isMounted]);

  useUnmount(() => {
    ref.current?.remove();
    ref.current = null;
  });

  return useCallback(
    async (text: string, successText?: string, errorText?: string) => {
      const popSuccessSnack = () => {
        const text = isNonEmptyString(successText)
          ? successText
          : 'Copied to clipboard!';
        snackbar.enqueueSnackbar(text, { variant: 'success' });
      };

      const popErrorSnack = () => {
        const text = isNonEmptyString(errorText)
          ? errorText
          : 'Error copying to clipboard!';
        snackbar.enqueueSnackbar(text, { variant: 'error' });
      };

      if (!window.isSecureContext && ref.current) {
        ref.current.textContent = text;
        // HERE BE HACKS
        const selection = window.getSelection();
        if (!selection) {
          popErrorSnack();
          console.error('Could not get window selection object');
          return;
        }

        selection.selectAllChildren(ref.current);
        const result = document.execCommand('copy');
        selection.removeAllRanges();
        if (result) {
          popSuccessSnack();
        } else {
          console.error('Unable to execute copy command');
          popErrorSnack();
        }

        return;
      }

      // Any chromium based browser
      // This is only supported by chromium: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard#using_the_clipboard_api
      try {
        if (browser.getEngineName() === 'Blink') {
          const result = await navigator.permissions.query({
            // @ts-expect-error -- clipboard-write not included in PermissionName enum
            name: 'clipboard-write',
          });

          if (result.state === 'granted' || result.state === 'prompt') {
            await navigator.clipboard.writeText(text);
          }
        } else {
          await navigator.clipboard.writeText(text);
        }

        popSuccessSnack();
      } catch (e) {
        console.error(e, 'Error while attempting to copy to clipboard');
        popErrorSnack();
      }
    },
    [browser, snackbar],
  );
};

export const useCopyToClipboardSync = () => {
  const copyToClipboard = useCopyToClipboard();

  return (...params: Parameters<typeof copyToClipboard>) => {
    copyToClipboard(...params).catch(console.error);
  };
};
