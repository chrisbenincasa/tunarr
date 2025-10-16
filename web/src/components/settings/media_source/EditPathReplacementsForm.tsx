import { ArrowRightAlt, Delete } from '@mui/icons-material';
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { MediaSourcePathReplacement } from '@tunarr/types';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

type FormSubtype = {
  pathReplacements: MediaSourcePathReplacement[];
};

export const EditPathReplacementsForm = () => {
  const form = useFormContext<FormSubtype>();
  const arr = useFieldArray({
    control: form.control,
    name: 'pathReplacements',
  });

  return (
    <Stack gap={1}>
      <Stack direction="row" flexWrap={'wrap'} alignItems={'center'}>
        <Typography>Path Replacements</Typography>
        <Button
          onClick={() => arr.append({ localPath: '', serverPath: '' })}
          sx={{ marginLeft: 'auto' }}
        >
          Add
        </Button>
        <Box sx={{ width: '100%' }} />
        <Typography variant="subtitle2">
          When file paths on the remote server differ from the paths Tunarr can
          see, use Path Replacements to instruct Tunarr how to stream media from
          disk.
        </Typography>
      </Stack>
      <Stack gap={1}>
        {arr.fields.map((replacement, index) => {
          return (
            <Stack direction={'row'} key={replacement.id}>
              <Controller
                control={form.control}
                name={`pathReplacements.${index}.serverPath`}
                rules={{
                  required: true,
                  minLength: 1,
                }}
                render={({ field }) => (
                  <TextField sx={{ flex: 1 }} label="Server Path" {...field} />
                )}
              />
              <ArrowRightAlt fontSize="large" sx={{ alignSelf: 'center' }} />
              <Controller
                control={form.control}
                name={`pathReplacements.${index}.localPath`}
                rules={{
                  required: true,
                  minLength: 1,
                }}
                render={({ field }) => (
                  <TextField sx={{ flex: 1 }} label="Local Path" {...field} />
                )}
              />
              <Box alignSelf={'center'} pl={1}>
                <IconButton onClick={() => arr.remove(index)} size="small">
                  <Delete />
                </IconButton>
              </Box>
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
};
