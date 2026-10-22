import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { ContentCopy } from '@mui/icons-material';
import { IconButton, type IconButtonProps } from '@mui/material';
import type React from 'react';

export const CopyToClipboardButton = (
  props: IconButtonProps & { content: string },
) => {
  const copyToClipboard = useCopyToClipboard();

  const handleClick = (e: React.SyntheticEvent) => {
    e.preventDefault();
    copyToClipboard(props.content).catch(console.warn);
  };

  return (
    <IconButton
      disableRipple
      sx={{ ml: 0.5, cursor: 'pointer', p: 0 }}
      size="small"
      onClick={handleClick}
      {...props}
    >
      <ContentCopy sx={{ fontSize: 'inherit' }} />
    </IconButton>
  );
};
