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
import { Trans, useLingui } from '@lingui/react/macro';

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
  const { t } = useLingui();
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
      <DialogTitle><Trans>Replicate Programs</Trans></DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="replication-form"
          onSubmit={handleSubmit(onSubmit)}
        >
          <DialogContentText>
            <Trans>Makes multiple copies of the schedule and plays them in sequence</Trans>
          </DialogContentText>

          <NumericFormControllerText
            control={control}
            name="numberOfReplications"
            prettyFieldName={t`Number of Replications`}
            rules={{ required: true, minLength: 1, min: 2 }}
            TextFieldProps={{
              fullWidth: true,
              margin: 'normal',
              label: t`Number of Replications`,
              helperText: ({ field, formState: { errors } }) =>
                isNil(errors['numberOfReplications'])
                  ? t`Your list will be replicated ${field.value} times`
                  : t`Please choose a value greater than 1`,
            }}
          />

          <FormControl fullWidth>
            <InputLabel><Trans>Type</Trans></InputLabel>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select label={t`Type`} {...field}>
                  <MenuItem key={'fixed'} value={'fixed'}>
                    <Trans>Fixed</Trans>
                  </MenuItem>
                  <MenuItem key={'random'} value={'random'}>
                    <Trans>Shuffle</Trans>
                  </MenuItem>
                </Select>
              )}
            />
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}><Trans>Cancel</Trans></Button>
        <Button variant="contained" form="replication-form" type="submit">
          <Trans>Save</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddReplicateModal;
