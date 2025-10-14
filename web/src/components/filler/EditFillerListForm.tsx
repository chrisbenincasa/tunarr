import { removeFillerListProgram } from '@/store/entityEditor/util.ts';
import {
  clearCurrentFillerList,
  resetFillerList,
  setCurrentFillerList,
  updateCurrentFillerList,
} from '@/store/fillerListEditor/action.ts';
import { Delete, Save, Tv, Undo } from '@mui/icons-material';
import { Button, Divider, Stack, TextField, Tooltip } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { FillerList } from '@tunarr/types';
import { isEmpty } from 'lodash-es';
import { useCallback } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import {
  postApiFillerLists,
  putApiFillerListsById,
} from '../../generated/sdk.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import useStore from '../../store/index.ts';
import type { UIFillerListProgram } from '../../types/index.ts';
import { RotatingLoopIcon } from '../base/LoadingIcon.tsx';
import ChannelLineupList from '../channel_config/ChannelLineupList.tsx';

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {
    programList,
    dirty: { programs: programsDirty },
  } = useStore((s) => s.fillerListEditor);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { isValid, isDirty, isSubmitting },
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
        return postApiFillerLists({
          body: { name, programs },
          throwOnError: true,
        });
      } else {
        return putApiFillerListsById({
          path: { id: fillerList.id },
          body: { name, programs },
          throwOnError: true,
        });
      }
    },
    onSuccess: async ({ data }, variables) => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Filler Lists'),
      });

      setCurrentFillerList(
        {
          ...fillerList,
          ...data,
        },
        variables.programs,
      );

      if (isNew) {
        clearCurrentFillerList();
        navigate({ to: '/library/fillers' }).catch(console.warn);
      }
    },
    onError: (e) => console.error(e),
  });

  const saveFiller: SubmitHandler<FillerListFormType> = (data) => {
    return saveShowMutation.mutateAsync({
      id: fillerList?.id,
      name: data.name,
      programs: programList,
    });
  };

  const deleteProgramAtIndex = useCallback((idx: number) => {
    removeFillerListProgram(idx);
  }, []);

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
            <Button
              disableRipple
              component="button"
              onClick={() => clearCurrentFillerList()}
              startIcon={<Delete />}
              variant="outlined"
              disabled={isEmpty(fillerListPrograms)}
            >
              Clear All
            </Button>
            {programsDirty && (
              <Button
                disableRipple
                component="button"
                onClick={() => resetFillerList()}
                startIcon={<Undo />}
                variant="outlined"
              >
                Reset
              </Button>
            )}
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
            <Button
              disabled={
                !isValid ||
                isSubmitting ||
                (!isDirty && !programsDirty) ||
                fillerListPrograms.length === 0
              }
              variant="contained"
              type="submit"
              startIcon={
                saveShowMutation.isPending ? <RotatingLoopIcon /> : <Save />
              }
            >
              Save
            </Button>
          </Stack>
          <ChannelLineupList
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
      </Stack>
    </Box>
  );
}
