import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useChannels } from '../../hooks/useChannels.ts';
import {
  Box,
  CircularProgress,
  FormControl,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import useStore from '../../store/index.ts';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { useEffect } from 'react';
import { usePrevious } from '@uidotdev/usehooks';
import { find, isNumber } from 'lodash-es';
import { addProgramsToCurrentChannel } from '../../store/channelEditor/actions.ts';
import { RedirectProgram } from '@tunarr/types';

dayjs.extend(duration);

type AddRedirectModalProps = {
  open: boolean;
  onClose: () => void;
};

type FormValues = {
  redirectChannelId: string;
  redirectDuration: number;
};

const AddRedirectModal = (props: AddRedirectModalProps) => {
  const currentChannel = useStore((s) => s.channelEditor.currentEntity);
  const { isPending, error, data } = useChannels();
  const previousData = usePrevious(data);

  const { control, setValue, handleSubmit } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      redirectChannelId: '',
      redirectDuration: 300,
    },
  });

  useEffect(() => {
    if (!previousData && data && currentChannel) {
      const firstChannel = find(
        data,
        (channel) => channel.id !== currentChannel.id,
      );
      if (firstChannel) {
        setValue('redirectChannelId', firstChannel.id);
      }
    }
  }, [previousData, data, setValue, currentChannel]);

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    const program: RedirectProgram = {
      channel: data.redirectChannelId,
      duration: data.redirectDuration * 1000,
      type: 'redirect',
      persisted: false,
    };
    addProgramsToCurrentChannel([program]);
    props.onClose();
  };

  const channelOptions = data?.filter(
    (channel) => channel.id !== currentChannel?.id,
  );

  const dialogContent = () => {
    if (!currentChannel || isPending) {
      return <CircularProgress />;
    } else if (data) {
      return (
        <FormGroup>
          <Controller
            control={control}
            name="redirectChannelId"
            render={({ field }) => (
              <FormControl fullWidth margin="normal">
                <InputLabel>Channel</InputLabel>
                <Select label="Channel" {...field}>
                  {channelOptions?.map((channel) => (
                    <MenuItem key={channel.number} value={channel.id}>
                      {channel.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          <Controller
            control={control}
            name="redirectDuration"
            rules={{ validate: isNumber }}
            render={({ field }) => (
              <TextField
                fullWidth
                margin="normal"
                label="Duration (seconds)"
                helperText={dayjs.duration(field.value, 'seconds').humanize()}
                {...field}
              />
            )}
          />
        </FormGroup>
      );
    } else {
      return (
        <Typography>
          Error occurred while loading channels, please try again soon.{' '}
          {error ? error.message : null}
        </Typography>
      );
    }
  };

  return (
    <Dialog open={props.open}>
      <DialogTitle>Add Channel Redirect</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="redirect-channel-form"
          onSubmit={handleSubmit(onSubmit)}
        >
          {dialogContent()}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose()}>Cancel</Button>
        <Button variant="contained" form="redirect-channel-form" type="submit">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRedirectModal;
