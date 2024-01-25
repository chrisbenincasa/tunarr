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
import { useCallback } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import AddSelectedMediaButton from '../../components/channel_config/AddSelectedMediaButton.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';
import {
  addPlexMediaToCurrentCustomShow,
  removeCustomShowProgram,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { CustomShow } from '@tunarr/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../external/api.ts';

type Props = { isNew: boolean };

export default function EditCustomShowPage({ isNew }: Props) {
  const customShow = useLoaderData() as CustomShow;
  const workingCustomShow = useStore((s) => s.customShowEditor.currentEntity);
  const customShowPrograms = useStore((s) => s.customShowEditor.programList);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const saveShowMutation = useMutation({
    mutationKey: ['custom-shows', isNew ? 'new' : customShow.id],
    mutationFn: async () => {
      return apiClient.createCustomShow({
        name: workingCustomShow.name,
        programs: customShowPrograms,
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

  const saveCustomShow = () => {
    saveShowMutation.mutate();
  };

  const deleteProgramAtIndex = useCallback((idx: number) => {
    removeCustomShowProgram(idx);
  }, []);

  const isValid =
    workingCustomShow.name.length > 0 && customShowPrograms.length > 0;

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
    <div>
      <Box>
        <Typography variant="h4" sx={{ mb: 2 }}>
          New Custom Show
        </Typography>
      </Box>
      <PaddedPaper sx={{ mb: 2 }}>
        <Stack>
          <TextField
            value={customShow.name}
            margin="normal"
            fullWidth
            label="Name"
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
              disabled={saveShowMutation.isPending || !isValid}
              variant="contained"
              onClick={() => saveCustomShow()}
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
          <ProgrammingSelector />
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
              onAdd={addPlexMediaToCurrentCustomShow}
              onSuccess={() => {}}
              variant="contained"
            />
          </Box>
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
