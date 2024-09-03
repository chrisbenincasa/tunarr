import { useAddSelectedItems } from '@/hooks/programming_controls/useAddProgramming.ts';
import { AddCircle } from '@mui/icons-material';
import { CircularProgress, Tooltip } from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import { ReactNode } from 'react';
import useStore from '../../store/index.ts';
import { AddedMedia } from '../../types/index.ts';

type Props = {
  onAdd: (items: AddedMedia[]) => void;
  onSuccess: () => void;
  buttonText?: string;
  tooltipTitle?: ReactNode;
} & ButtonProps;

export default function AddSelectedMediaButton({
  onAdd,
  onSuccess,
  buttonText,
  tooltipTitle,
  ...rest
}: Props) {
  const selectedMedia = useStore((s) => s.selectedMedia);
  const { addSelectedItems, isLoading } = useAddSelectedItems(onAdd, onSuccess);

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
