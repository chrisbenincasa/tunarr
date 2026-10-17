import { isNonEmptyString } from '@/helpers/util';
import { t } from '@lingui/core/macro';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

// Fallback for plain HTTP, where navigator.clipboard does not exist.
// execCommand('copy') fires a copy event, and the listener supplies the text.
// Nothing gets selected or focused, so MUI focus traps in menus and dialogs
// cannot cancel the copy.
function copyWithExecCommand(text: string): boolean {
  let copied = false;
  const onCopy = (e: ClipboardEvent) => {
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
      copied = true;
    }
  };

  document.addEventListener('copy', onCopy, { capture: true });
  try {
    return document.execCommand('copy') && copied;
  } finally {
    document.removeEventListener('copy', onCopy, { capture: true });
  }
}

async function writeToClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard !== undefined) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn(e, 'Clipboard API write failed; trying execCommand');
    }
  }

  return copyWithExecCommand(text);
}

export const useCopyToClipboard = () => {
  const snackbar = useSnackbar();

  return useCallback(
    async (text: string, successText?: string, errorText?: string) => {
      if (await writeToClipboard(text)) {
        snackbar.enqueueSnackbar(
          isNonEmptyString(successText) ? successText : t`Copied to clipboard!`,
          { variant: 'success' },
        );
      } else {
        console.error('Unable to copy to clipboard');
        snackbar.enqueueSnackbar(
          isNonEmptyString(errorText)
            ? errorText
            : t`Error copying to clipboard!`,
          { variant: 'error' },
        );
      }
    },
    [snackbar],
  );
};

export const useCopyToClipboardSync = () => {
  const copyToClipboard = useCopyToClipboard();

  return (...params: Parameters<typeof copyToClipboard>) => {
    copyToClipboard(...params).catch(console.error);
  };
};
