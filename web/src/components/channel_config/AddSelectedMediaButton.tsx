import { useAddSelectedMediaItems } from '@/hooks/programming_controls/useEnumerateSelectedMediaItems.ts';
import { AddCircle } from '@mui/icons-material';
import { CircularProgress, Tooltip } from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import { ReactNode } from 'react';
import useStore from '../../store/index.ts';

type Props = {
  buttonText?: string;
  tooltipTitle?: ReactNode;
} & ButtonProps;

export default function AddSelectedMediaButton({
  buttonText,
  tooltipTitle,
  ...rest
}: Props) {
  const selectedMedia = useStore((s) => s.selectedMedia);
  const { addSelectedItems, isLoading } = useAddSelectedMediaItems();

  return (
    <Tooltip
      title={
        selectedMedia.length === 0
          ? 'No programs selected'
          : tooltipTitle ?? 'Add all selected programs to channel'
      }
    >
      <span>
        <Button
          onClick={(e) => addSelectedItems(e)}
          disabled={selectedMedia.length === 0 || isLoading}
          {...(rest ?? {})}
          startIcon={
            isLoading ? (
              <CircularProgress size="20px" sx={{ mx: 1, color: 'inherit' }} />
            ) : (
              <AddCircle />
            )
          }
        >
          {buttonText ?? 'Add All'}
        </Button>
      </span>
    </Tooltip>
  );
}
