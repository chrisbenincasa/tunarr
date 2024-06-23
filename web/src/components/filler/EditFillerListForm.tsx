import { Tv } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { FillerList } from '@tunarr/types';
import { useCallback, useEffect } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { removeFillerListProgram } from '@/store/entityEditor/util.ts';
import { UIFillerListProgram } from '../../types/index.ts';

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
    formState: { isValid },
    register,
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
      navigate({ to: '/library/fillers' }).catch(console.warn);
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

  const renderPrograms = () => {
    return fillerListPrograms.length > 0 ? (
      fillerListPrograms.map((p, idx) => {
        let id: string;
        let title: string;
        switch (p.type) {
          case 'custom':
            id = p.id;
            title = 'Custom';
            break;
          case 'content':
            if (p.episodeTitle) {
              title = `${p.title} - ${p.episodeTitle}`;
            } else {
              title = p.title;
            }

            id = p.persisted
              ? p.id!
              : `${p.externalSourceType}|${p.externalSourceName}|${
                  p.originalProgram!.key
                }`;
            break;
        }

        const key = `${p.type}|${id}`;

        return (
          <ListItem
            key={key}
            secondaryAction={
              <IconButton
                onClick={() => deleteProgramAtIndex(idx)}
                edge="end"
                aria-label="delete"
              >
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText
              primary={title}
              sx={{ fontStyle: p.persisted ? 'normal' : 'italic' }}
            />
          </ListItem>
        );
      })
    ) : (
      <Typography align="center">No media added yet.</Typography>
    );
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
        {/* TODO put this on the same line as the Programming header and push it to the right. */}
        <Box alignSelf={'flex-end'} gap={0}>
          <Tooltip title="Add TV Shows or Movies to filler" placement="right">
            <Button
              disableRipple
              component={Link}
              to={isNew ? './programming' : '../programming'}
              startIcon={<Tv />}
              variant="contained"
            >
              Add Media
            </Button>
          </Tooltip>
        </Box>

        <Box>
          <Typography>Programming</Typography>
          <Box display="flex">
            <Box sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
              <List {...register('programs', { minLength: 1 })} dense>
                {renderPrograms()}
              </List>
            </Box>
          </Box>
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
