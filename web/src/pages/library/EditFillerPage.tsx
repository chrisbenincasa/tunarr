import { usePreloadedFiller } from '@/hooks/usePreloadedFiller.ts';
import { Tv } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Button,
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
import { useCallback, useEffect } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';
import { removeFillerListProgram } from '../../store/channelEditor/actions.ts';
import { UIFillerListProgram } from '../../types/index.ts';

export type Props = { isNew: boolean };

export type FillerListMutationArgs = {
  id?: string;
  name: string;
  programs: UIFillerListProgram[];
};

export type FillerListFormType = Omit<FillerListMutationArgs, 'id'>;

export default function EditFillerPage({ isNew }: Props) {
  const apiClient = useTunarrApi();
  const { currentEntity: fillerList, programList: fillerListPrograms } =
    usePreloadedFiller();

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    control,
    setValue,
    handleSubmit,
    formState: { isValid },
    reset,
    register,
  } = useForm<FillerListFormType>({
    mode: 'onChange',
    defaultValues: {
      name: fillerList?.name ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: fillerList?.name,
    });
  }, [fillerList?.name, reset]);

  const saveShowMutation = useMutation({
    mutationKey: ['fillers', isNew ? 'new' : fillerList?.id],
    mutationFn: async ({ name, programs }: FillerListMutationArgs) => {
      if (isNew) {
        return apiClient.createFillerList({ name, programs });
      } else {
        return apiClient.updateFillerList(
          { name, programs },
          { params: { id: fillerList!.id } },
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['fillers'],
        exact: false,
      });
      navigate('/library/fillers');
    },
    onError: (e) => console.error(e),
  });

  const onCancel = useCallback(() => {
    navigate('/library/fillers');
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
    <Box>
      <Breadcrumbs />
      <Box component="form" onSubmit={handleSubmit(saveFiller, console.error)}>
        <Box>
          <Typography variant="h4" sx={{ mb: 2 }}>
            {isNew ? 'New Filler List' : 'Edit Filler List'}
          </Typography>
        </Box>
        <PaddedPaper sx={{ mb: 2 }}>
          <Stack>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <TextField margin="normal" fullWidth label="Name" {...field} />
              )}
            />
            <Box>
              <Tooltip
                title="Add TV Shows or Movies to filler"
                placement="right"
              >
                <Button
                  disableRipple
                  component={Link}
                  to="../fillers/programming/add"
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
        </PaddedPaper>
      </Box>
    </Box>
  );
}
