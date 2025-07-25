import {
  Box,
  CircularProgress,
  FormControl,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import type { RedirectProgram } from '@tunarr/types';
import { usePrevious } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { filter, find, isNil, isUndefined } from 'lodash-es';
import { useEffect } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { uuidRegexPattern } from '../../helpers/util.ts';
import { useChannels } from '../../hooks/useChannels.ts';
import {
  addProgramsToCurrentChannel,
  setProgramAtIndex,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { NumericFormControllerText } from '../util/TypedController.tsx';
import type { UIRedirectProgram } from '../../types/index.ts';
import { betterHumanize } from '../../helpers/dayjs.ts';

dayjs.extend(duration);

type AddRedirectModalProps = {
  open: boolean;
  onClose: () => void;
  initialProgram?: UIRedirectProgram & { index: number };
};

type FormValues = {
  redirectChannelId: string;
  redirectDuration: number;
};

const AddRedirectModal = (props: AddRedirectModalProps) => {
  const currentChannel = useStore((s) => s.channelEditor.currentEntity);
  const { isPending, error, data: channels } = useChannels();
  const previousData = usePrevious(channels);
  const { control, setValue, handleSubmit, reset } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      redirectChannelId: '',
      redirectDuration: !isUndefined(props.initialProgram)
        ? props.initialProgram.duration / 1000
        : 300,
    },
  });

  useEffect(() => {
    if (props.initialProgram) {
      reset({
        redirectChannelId: props.initialProgram.channel,
        redirectDuration: props.initialProgram.duration / 1000,
      });
    }
  }, [props.initialProgram, reset]);

  useEffect(() => {
    if (!previousData && channels && currentChannel) {
      const firstChannel = find(
        channels,
        (channel) =>
          channel.id !== currentChannel.id &&
          (!isUndefined(props.initialProgram)
            ? props.initialProgram.channel === channel.id
            : true),
      );

      if (firstChannel) {
        setValue('redirectChannelId', firstChannel.id);
      }
    }
  }, [previousData, channels, setValue, currentChannel, props.initialProgram]);

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    if (channels) {
      // Must exist
      const channel = find(channels, { id: data.redirectChannelId })!;
      const program: RedirectProgram = {
        channel: data.redirectChannelId,
        channelName: channel.name,
        channelNumber: channel.number,
        duration: data.redirectDuration * 1000,
        type: 'redirect',
        persisted: false,
      };

      if (isUndefined(props.initialProgram)) {
        addProgramsToCurrentChannel([program]);
      } else {
        setProgramAtIndex(
          { ...props.initialProgram, ...program },
          props.initialProgram.index,
        );
      }

      props.onClose();
    }
  };

  const channelOptions = filter(
    channels,
    (channel) => channel.id !== currentChannel?.id,
  );

  const dialogContent = () => {
    if (!currentChannel || isPending) {
      return <CircularProgress />;
    } else if (channels) {
      return (
        <FormGroup>
          <Controller
            control={control}
            name="redirectChannelId"
            rules={{ minLength: 1, pattern: new RegExp(uuidRegexPattern) }}
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
          <NumericFormControllerText
            control={control}
            name="redirectDuration"
            prettyFieldName="Redirect duration"
            rules={{ required: true, minLength: 1, min: 1 }}
            TextFieldProps={{
              fullWidth: true,
              margin: 'normal',
              label: 'Duration (seconds)',
              helperText: ({ field, formState: { errors } }) =>
                isNil(errors['redirectDuration'])
                  ? betterHumanize(dayjs.duration(field.value, 'seconds'))
                  : null,
            }}
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
      <DialogTitle>
        {isUndefined(props.initialProgram) ? 'Add' : 'Edit'} Channel Redirect
      </DialogTitle>
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
