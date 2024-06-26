import { useAddBreaks } from '@/hooks/programming_controls/useAddBreaks';
import {
  Box,
  DialogContentText,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

type AddBreaksModalProps = {
  open: boolean;
  onClose: () => void;
};

export type AddBreaksConfig = {
  afterMinutes: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
};

const afterOptions = [5, 10, 15, 20, 25, 30, 60, 90, 120];

const minDurationOptions = [
  10, 15, 30, 45, 60, 90, 120, 180, 300, 450, 600, 1200, 1800,
];

const maxDurationOptions = [
  10, 15, 30, 45, 60, 90, 120, 180, 300, 450, 600, 1200, 1800,
];

const AddBreaksModal = ({ open, onClose }: AddBreaksModalProps) => {
  const addBreaks = useAddBreaks();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddBreaksConfig>({
    mode: 'onChange',
    defaultValues: {
      afterMinutes: 5,
      minDurationSeconds: 10,
      maxDurationSeconds: 120,
    },
  });

  const doSubmit: SubmitHandler<AddBreaksConfig> = (data) => {
    addBreaks(data);
    onClose();
  };

  return (
    <Dialog
      open={open}
      component="form"
      onSubmit={handleSubmit(doSubmit, console.error)}
    >
      <DialogTitle>Add Breaks</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Adds Flex breaks between programs, attempting to avoid groups of
          consecutive programs that exceed the specified number of minutes.
        </DialogContentText>
        <Box sx={{ my: 1 }}>
          <Stack flex={1}>
            <FormControl fullWidth sx={{ my: 1, flexGrow: 1 }}>
              <InputLabel id="add-breaks-after-label">After</InputLabel>
              <Controller
                control={control}
                name="afterMinutes"
                render={({ field }) => (
                  <Select
                    label={'After'}
                    labelId="add-breaks-after-label"
                    id="add-breaks-after"
                    {...field}
                  >
                    {afterOptions.map((minute) => (
                      <MenuItem key={minute} value={minute}>
                        {`${minute} Minutes`}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
            <FormControl fullWidth sx={{ my: 1, flexGrow: 1 }}>
              <InputLabel id="rerun-block-label">Min Duration</InputLabel>
              <Controller
                control={control}
                name="minDurationSeconds"
                rules={{
                  validate: {
                    lt: (value, form) => {
                      return value >= form.maxDurationSeconds
                        ? 'Minimum duration must be less than max'
                        : undefined;
                    },
                  },
                }}
                render={({ field }) => (
                  <Select
                    label={'Min Duration'}
                    labelId="add-breaks-min-duration-label"
                    id="add-breaks-min-duration"
                    {...field}
                  >
                    {minDurationOptions.map((duration) => (
                      <MenuItem key={duration} value={duration}>
                        {`${duration} Seconds`}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.minDurationSeconds && (
                <FormHelperText error={true}>
                  {errors.minDurationSeconds.message}
                </FormHelperText>
              )}
            </FormControl>
            <FormControl sx={{ my: 1, display: 'flex', flexGrow: 1 }}>
              <InputLabel id="add-breaks-max-duration-label">
                Max Duration
              </InputLabel>
              <Controller
                control={control}
                name="maxDurationSeconds"
                rules={{
                  validate: {
                    gt: (value, form) => {
                      return value <= form.minDurationSeconds
                        ? 'Maximum duration must be greater than min'
                        : undefined;
                    },
                  },
                }}
                render={({ field }) => (
                  <Select
                    label={'Max Duration'}
                    labelId="add-breaks-max-duration-label"
                    id="add-breaks-max-duration"
                    {...field}
                  >
                    {maxDurationOptions.map((duration) => (
                      <MenuItem key={duration} value={duration}>
                        {`${duration} Seconds`}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.maxDurationSeconds && (
                <FormHelperText error={true}>
                  {errors.maxDurationSeconds.message}
                </FormHelperText>
              )}
            </FormControl>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" type="submit">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddBreaksModal;
