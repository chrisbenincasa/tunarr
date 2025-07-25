import {
  Box,
  DialogContentText,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { isNil } from 'lodash-es';
import { useEffect } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { useReplicatePrograms } from '../../hooks/programming_controls/useReplicatePrograms';
import { NumericFormControllerText } from '../util/TypedController';

type AddReplicateModalProps = {
  open: boolean;
  onClose: () => void;
};

export type ReplicationType = 'fixed' | 'random';

type FormValues = {
  numberOfReplications: number;
  type: ReplicationType;
};

const AddReplicateModal = ({ open, onClose }: AddReplicateModalProps) => {
  const replicateProgram = useReplicatePrograms();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitSuccessful },
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      numberOfReplications: 2,
      type: 'fixed',
    },
  });

  useEffect(() => {
    reset();
  }, [isSubmitSuccessful, reset]);

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    replicateProgram(data.numberOfReplications, data.type);
    onClose();
  };

  return (
    <Dialog open={open}>
      <DialogTitle>Replicate Programs</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="replication-form"
          onSubmit={handleSubmit(onSubmit)}
        >
          <DialogContentText>
            Makes multiple copies of the schedule and plays them in sequence
          </DialogContentText>

          <NumericFormControllerText
            control={control}
            name="numberOfReplications"
            prettyFieldName="Number of Replications"
            rules={{ required: true, minLength: 1, min: 2 }}
            TextFieldProps={{
              fullWidth: true,
              margin: 'normal',
              label: 'Number of Replications',
              helperText: ({ field, formState: { errors } }) =>
                isNil(errors['numberOfReplications'])
                  ? `Your list will be replicated ${field.value} times`
                  : 'Please choose a valuegst greater than 1',
            }}
          />

          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select label="Type" {...field}>
                  <MenuItem key={'fixed'} value={'fixed'}>
                    Fixed
                  </MenuItem>
                  <MenuItem key={'random'} value={'random'}>
                    Shuffle
                  </MenuItem>
                </Select>
              )}
            />
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" form="replication-form" type="submit">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddReplicateModal;
