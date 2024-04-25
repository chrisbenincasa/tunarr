import { Save } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { SaveChannelRequest } from '@tunarr/types';
import { useContext } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  ChannelEditContext,
  ChannelEditTab,
} from '../../pages/channels/EditChannelContext.ts';
import { isUndefined } from 'lodash-es';

type Props = {
  onNav: (tab: ChannelEditTab) => void;
};

export default function ChannelEditActions({ onNav }: Props) {
  const channelEditorState = useContext(ChannelEditContext);
  const {
    formState: { isValid, isDirty, isSubmitting },
    reset,
  } = useFormContext<SaveChannelRequest>();

  const renderNewChannelActions = () => {
    const prevButton = !isUndefined(channelEditorState.currentTab.prev) ? (
      <Button onClick={() => onNav(channelEditorState.currentTab.prev!)}>
        Previous
      </Button>
    ) : null;
    const nextButton = !isUndefined(channelEditorState.currentTab.next) ? (
      <Button onClick={() => onNav(channelEditorState.currentTab.next!)}>
        Next
      </Button>
    ) : null;

    return (
      <>
        {prevButton}
        {nextButton}
        <Button
          disabled={!isValid || isSubmitting}
          variant="contained"
          type="submit"
          startIcon={
            isSubmitting ? (
              <CircularProgress size="20px" sx={{ mx: 1, color: '#fff' }} />
            ) : (
              <Save />
            )
          }
        >
          Finish
        </Button>
      </>
    );
  };

  const renderEditChannelActions = () => {
    return (
      <>
        {isDirty && (
          <Button onClick={() => reset()} variant="outlined">
            Reset Changes
          </Button>
        )}
        <Button
          disabled={!isValid || !isDirty || isSubmitting}
          variant="contained"
          type="submit"
          startIcon={
            isSubmitting ? (
              <CircularProgress size="20px" sx={{ mx: 1, color: '#fff' }} />
            ) : (
              <Save />
            )
          }
        >
          Save
        </Button>
      </>
    );
  };

  return (
    <Stack spacing={2} direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
      {!channelEditorState.isNewChannel
        ? renderEditChannelActions()
        : renderNewChannelActions()}
    </Stack>
  );
}
