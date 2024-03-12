import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
} from '@mui/material';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import AddSelectedMediaButton from '../../components/channel_config/AddSelectedMediaButton.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';
import { apiClient } from '../../external/api.ts';
import { EnrichedPlexMedia } from '../../hooks/plexHooks.ts';
import { useCurrentFillerList } from '../../hooks/useFillerLists.ts';
import {
  addPlexMediaToCurrentFillerList,
  removeFillerListProgram,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { UIFillerListProgram } from '../../types/index.ts';

type Props = { isNew: boolean };

type FillerListMutationArgs = {
  id?: string;
  name: string;
  programs: UIFillerListProgram[];
};

type FillerListFormType = Omit<FillerListMutationArgs, 'id'>;

export default function EditFillerPage({ isNew }: Props) {
  const fillerList = useCurrentFillerList()!;
  const fillerListPrograms = useStore((s) => s.fillerListEditor.programList);
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
      name: '',
      programs: [],
    },
  });

  useEffect(() => {
    reset({
      name: fillerList.name,
    });
  }, [fillerList.name, reset]);

  const saveShowMutation = useMutation({
    mutationFn: async ({ id, name, programs }: FillerListMutationArgs) => {
      if (isNew) {
        return apiClient.createFillerList({ name, programs });
      } else {
        return apiClient.updateFillerList(
          { name, programs },
          { params: { id: id! } },
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
      id: fillerList.id,
      name: data.name,
      programs: data.programs,
    });
  };

  const deleteProgramAtIndex = useCallback((idx: number) => {
    removeFillerListProgram(idx);
  }, []);

  const onAddPrograms = (programs: EnrichedPlexMedia[]) => {
    addPlexMediaToCurrentFillerList(programs);
  };

  useEffect(() => {
    setValue('programs', fillerListPrograms);
  }, [fillerListPrograms, setValue]);

  const renderPrograms = () => {
    return fillerListPrograms.map((p, idx) => {
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
    });
  };

  return (
    <Box>
      <Breadcrumbs />
      <Box component="form" onSubmit={handleSubmit(saveFiller)}>
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
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            Add Programming
          </AccordionSummary>
          <AccordionDetails>
            <ProgrammingSelector
              onAddSelectedMedia={addPlexMediaToCurrentFillerList}
            />
            <Divider />
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                mt: 2,
              }}
            >
              <AddSelectedMediaButton
                onAdd={onAddPrograms}
                onSuccess={() => {}}
                variant="contained"
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
}
