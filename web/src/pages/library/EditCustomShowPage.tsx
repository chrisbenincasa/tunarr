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
import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import {
  existingCustomShowLoader,
  newCustomShowLoader,
} from '../../preloaders/customShowLoaders.ts';
import {
  addMediaToCurrentCustomShow,
  removeCustomShowProgram,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { UICustomShowProgram } from '../../types/index.ts';

type Props = { isNew: boolean };

type CustomShowForm = {
  name: string;
};

export default function EditCustomShowPage({ isNew }: Props) {
  const { show: customShow } = usePreloadedData(
    isNew ? existingCustomShowLoader : newCustomShowLoader,
  );
  const customShowPrograms = useStore((s) => s.customShowEditor.programList);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    control,
    reset,
    handleSubmit,
    formState: { isValid },
  } = useForm<CustomShowForm>({
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    console.log(customShow, 'reset');
    reset({
      name: customShow.name,
    });
  }, [customShow, reset]);

  const saveShowMutation = useMutation({
    mutationKey: ['custom-shows', isNew ? 'new' : customShow.id],
    mutationFn: async (
      data: CustomShowForm & { programs: UICustomShowProgram[] },
    ) => {
      return apiClient.createCustomShow({
        name: data.name,
        programs: data.programs,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['custom-shows'],
        exact: false,
      });
      navigate('/library/custom-shows');
    },
  });

  const onCancel = useCallback(() => {
    navigate('/library/custom-shows');
  }, [navigate]);

  const saveCustomShow: SubmitHandler<CustomShowForm> = (
    data: CustomShowForm,
  ) => {
    saveShowMutation.mutate({ ...data, programs: customShowPrograms });
  };

  const deleteProgramAtIndex = useCallback((idx: number) => {
    removeCustomShowProgram(idx);
  }, []);

  const renderPrograms = () => {
    return customShowPrograms.map((p, idx) => {
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
    <Box component="form" onSubmit={handleSubmit(saveCustomShow)}>
      <Box>
        <Breadcrumbs />
        <Typography variant="h4" sx={{ mb: 2 }}>
          {isNew ? 'New' : 'Edit'} Custom Show
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
                <List dense>{renderPrograms()}</List>
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
              disabled={
                saveShowMutation.isPending ||
                !isValid ||
                customShowPrograms.length === 0
              }
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
            onAddSelectedMedia={addMediaToCurrentCustomShow}
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
              onAdd={addMediaToCurrentCustomShow}
              onSuccess={() => {}}
              variant="contained"
            />
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
