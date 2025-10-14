import { queryClient } from '@/queryClient';
import useStore from '@/store';
import {
  clearCurrentCustomShow,
  moveProgramInCustomShow,
  resetCustomShowProgramming,
  updateCurrentCustomShow,
} from '@/store/customShowEditor/actions.ts';
import { removeCustomShowProgram } from '@/store/entityEditor/util';
import { type UICustomShowProgram } from '@/types';
import { Save, Tv, Undo } from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type CustomShow } from '@tunarr/types';
import { useEffect } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { getApiCustomShowsQueryKey } from '../../generated/@tanstack/react-query.gen.ts';
import {
  createCustomShow,
  putApiCustomShowsById,
} from '../../generated/sdk.gen.ts';
import ChannelLineupList from '../channel_config/ChannelLineupList.tsx';
import { CustomShowSortToolsMenu } from './CustomShowSortToolsMenu.tsx';

type CustomShowForm = {
  id?: string;
  name: string;
};

type Props = {
  customShow: CustomShow;
  customShowPrograms: UICustomShowProgram[];
  isNew: boolean;
};

export function EditCustomShowsForm({
  customShow,
  customShowPrograms,
  isNew,
}: Props) {
  const navigate = useNavigate();
  const customShowProgrammingChanged = useStore(
    (s) => s.customShowEditor.dirty.programs,
  );

  const {
    control,
    reset,
    handleSubmit,
    getValues,
    formState: { isValid, isDirty },
  } = useForm<CustomShowForm>({
    defaultValues: {
      name: customShow.name ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: customShow.name,
    });
  }, [customShow, reset]);

  const saveShowMutation = useMutation({
    mutationKey: ['custom-shows', isNew ? 'new' : customShow.id],
    mutationFn: async (
      data: CustomShowForm & { programs: UICustomShowProgram[] },
    ) => {
      if (isNew) {
        return createCustomShow({ body: data });
      } else {
        return putApiCustomShowsById({
          path: {
            id: customShow.id,
          },
          body: data,
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getApiCustomShowsQueryKey(),
        exact: false,
      });
      clearCurrentCustomShow();
      navigate({ to: '/library/custom-shows' }).catch(console.warn);
    },
  });

  const saveCustomShow: SubmitHandler<CustomShowForm> = (
    data: CustomShowForm,
  ) => {
    saveShowMutation.mutate({ ...data, programs: customShowPrograms });
  };

  const navToProgramming = () => {
    if (isNew) {
      updateCurrentCustomShow(getValues());
    }
    navigate({
      to: isNew
        ? '/library/custom-shows/new/programming'
        : `/library/custom-shows/$showId/programming`,
      params: { showId: customShow?.id },
    }).catch(console.warn);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(saveCustomShow)}>
      <Stack gap={2}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField margin="normal" fullWidth label="Name" {...field} />
          )}
        />
        <Divider />
        <Box>
          <Box>
            <Stack
              direction="row"
              sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap' }}
              gap={2}
            >
              <Typography
                variant="h6"
                sx={{ flex: 1, flexBasis: ['100%', 'auto'] }}
              >
                Programming
              </Typography>

              <CustomShowSortToolsMenu />
              {customShowProgrammingChanged && (
                <Tooltip title="Reset programming to most recently saved state">
                  <Button
                    variant="contained"
                    startIcon={<Undo />}
                    onClick={() => resetCustomShowProgramming()}
                  >
                    Reset
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Add programming to custom show" placement="top">
                <Button
                  disableRipple
                  component="button"
                  onClick={() => navToProgramming()}
                  startIcon={<Tv />}
                  variant="contained"
                >
                  Add Media
                </Button>
              </Tooltip>
              <Button
                disabled={
                  saveShowMutation.isPending ||
                  !isValid ||
                  (!isDirty && !customShowProgrammingChanged) ||
                  customShowPrograms.length === 0
                }
                variant="contained"
                type="submit"
                startIcon={<Save />}
              >
                Save
              </Button>
            </Stack>
          </Box>
          <Paper>
            <ChannelLineupList
              type="selector"
              programListSelector={(s) => s.customShowEditor.programList}
              moveProgram={moveProgramInCustomShow}
              deleteProgram={removeCustomShowProgram}
              virtualListProps={{
                width: '100%',
                height: 600,
                itemSize: 35, //smallViewport ? 70 : 35,
              }}
            />
          </Paper>
        </Box>
      </Stack>
    </Box>
  );
}
