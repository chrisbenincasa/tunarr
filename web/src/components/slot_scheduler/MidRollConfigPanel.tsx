import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { BaseSlot, MidRollConfig } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { Controller, useFormContext } from 'react-hook-form';

const programTypeLabels: Record<
  NonNullable<MidRollConfig['programTypes']>[number],
  string
> = {
  movie: 'Movies',
  episode: 'Episodes',
  track: 'Music Tracks',
  music_video: 'Music Videos',
  other_video: 'Other Videos',
};

const allProgramTypes = Object.keys(programTypeLabels) as NonNullable<
  MidRollConfig['programTypes']
>;

function msToMinutes(ms: number): number {
  return Math.round(dayjs.duration(ms).asMinutes());
}

function minutesToMs(minutes: number): number {
  return dayjs.duration({ minutes }).asMilliseconds();
}

export const MidRollConfigPanel = () => {
  const { control } = useFormContext<BaseSlot>();

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Mid-roll inserts commercial breaks within long programs at fixed
        intervals. Configure which filler list to use on the Filler tab.
      </Typography>
      <Controller
        control={control}
        name={'midRoll.intervalMs' as never}
        defaultValue={minutesToMs(30) as never}
        render={({ field }) => (
          <TextField
            label="Break Interval (minutes)"
            type="number"
            inputProps={{ min: 1 }}
            value={msToMinutes(field.value as number)}
            onChange={(e) =>
              field.onChange(minutesToMs(Number(e.target.value)))
            }
            helperText="How often to insert a break"
          />
        )}
      />
      <Controller
        control={control}
        name={'midRoll.breakDurationMs' as never}
        defaultValue={minutesToMs(3) as never}
        render={({ field }) => (
          <TextField
            label="Break Duration (minutes)"
            type="number"
            inputProps={{ min: 1 }}
            value={msToMinutes(field.value as number)}
            onChange={(e) =>
              field.onChange(minutesToMs(Number(e.target.value)))
            }
            helperText="How long each commercial break lasts"
          />
        )}
      />
      <Controller
        control={control}
        name={'midRoll.maxBreaks' as never}
        defaultValue={0 as never}
        render={({ field }) => (
          <TextField
            label="Max Breaks"
            type="number"
            inputProps={{ min: 0 }}
            value={field.value as number}
            onChange={(e) => field.onChange(Number(e.target.value))}
            helperText="Maximum number of breaks per program (0 = unlimited)"
          />
        )}
      />
      <Controller
        control={control}
        name={'midRoll.minProgramDurationMs' as never}
        defaultValue={minutesToMs(60) as never}
        render={({ field }) => (
          <TextField
            label="Minimum Program Duration (minutes)"
            type="number"
            inputProps={{ min: 0 }}
            value={msToMinutes(field.value as number)}
            onChange={(e) =>
              field.onChange(minutesToMs(Number(e.target.value)))
            }
            helperText="Skip mid-roll for programs shorter than this"
          />
        )}
      />
      <Controller
        control={control}
        name={'midRoll.programTypes' as never}
        defaultValue={[] as never}
        render={({ field }) => {
          const selectedTypes = (field.value as string[] | undefined) ?? [];
          const handleChange = (
            type: (typeof allProgramTypes)[number],
            checked: boolean,
          ) => {
            if (checked) {
              field.onChange([...selectedTypes, type]);
            } else {
              field.onChange(selectedTypes.filter((t) => t !== type));
            }
          };
          return (
            <FormControl component="fieldset">
              <FormLabel component="legend">
                Apply to Program Types (empty = all)
              </FormLabel>
              <FormGroup row>
                {allProgramTypes.map((type) => (
                  <FormControlLabel
                    key={type}
                    control={
                      <Checkbox
                        checked={selectedTypes.includes(type)}
                        onChange={(e) => handleChange(type, e.target.checked)}
                      />
                    }
                    label={programTypeLabels[type]}
                  />
                ))}
              </FormGroup>
            </FormControl>
          );
        }}
      />
    </Stack>
  );
};
