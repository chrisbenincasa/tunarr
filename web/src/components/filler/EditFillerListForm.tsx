import { removeFillerListProgram } from '@/store/entityEditor/util.ts';
import {
  clearCurrentFillerList,
  updateCurrentFillerList,
} from '@/store/fillerListEditor/action.ts';
import { Tv } from '@mui/icons-material';
import { Button, Divider, Stack, TextField, Tooltip } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { FillerList } from '@tunarr/types';
import { useCallback, useEffect } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { UIFillerListProgram } from '../../types/index.ts';
import ChannelProgrammingList from '../channel_config/ChannelProgrammingList.tsx';

export type FillerListMutationArgs = {
  id?: string;
  name: string;
  programs: UIFillerListProgram[];
};

export type FillerListFormType = Omit<FillerListMutationArgs, 'id'>;

type EditFillerListFormProps = {
  fillerList: FillerList;
  fillerListPrograms: UIFillerListProgram[];
  isNew: boolean;
};

export function EditFillerListForm({
  fillerList,
  fillerListPrograms,
  isNew,
}: EditFillerListFormProps) {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    control,
    setValue,
    handleSubmit,
    getValues,
    formState: { isValid },
  } = useForm<FillerListFormType>({
    mode: 'onChange',
    defaultValues: {
      name: fillerList?.name ?? '',
    },
  });

  const saveShowMutation = useMutation({
    mutationKey: ['fillers', isNew ? 'new' : fillerList.id],
    mutationFn: async ({ name, programs }: FillerListMutationArgs) => {
      if (isNew) {
        return apiClient.createFillerList({ name, programs });
      } else {
        return apiClient.updateFillerList(
          { name, programs },
          { params: { id: fillerList.id } },
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['fillers'],
        exact: false,
      });
      if (isNew) {
        clearCurrentFillerList();
        navigate({ to: '/library/fillers' }).catch(console.warn);
      }
    },
    onError: (e) => console.error(e),
  });

  const onCancel = useCallback(() => {
    navigate({ to: '/library/fillers' }).catch(console.warn);
  }, [navigate]);

  const saveFiller: SubmitHandler<FillerListFormType> = (data) => {
    return saveShowMutation.mutateAsync({
      id: fillerList?.id,
      name: data.name,
      programs: data.programs,
    });
  };

  const deleteProgramAtIndex = useCallback((idx: number) => {
    removeFillerListProgram(idx);
  }, []);

  useEffect(() => {
    setValue('programs', fillerListPrograms);
  }, [fillerListPrograms, setValue]);

  const navToProgramming = () => {
    if (isNew) {
      updateCurrentFillerList(getValues());
    }
    navigate({
      to: isNew
        ? '/library/fillers/new/programming'
        : `/library/fillers/$fillerId/programming`,
      params: { fillerId: fillerList?.id },
    }).catch(console.warn);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(saveFiller, console.error)}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Programming
            </Typography>
            <Tooltip title="Add TV Shows or Movies to filler" placement="right">
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
          </Box>
          <ChannelProgrammingList
            type="selector"
            programListSelector={(s) => s.fillerListEditor.programList}
            enableDnd={false}
            enableRowEdit={false}
            showProgramCount
            deleteProgram={deleteProgramAtIndex}
            virtualListProps={{
              width: '100%',
              height: 600,
              itemSize: 35,
            }}
          />
        </Box>
        <Stack
          spacing={2}
          direction="row"
          justifyContent="right"
          sx={{ mt: 2 }}
        >
          <Button onClick={() => onCancel()}>Cancel</Button>
          <Button
            disabled={!isValid || fillerListPrograms.length === 0}
            variant="contained"
            type="submit"
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
