import CloudOffIcon from '@mui/icons-material/CloudOff';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SortIcon from '@mui/icons-material/Sort';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  Input,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import Grid2 from '@mui/material/Unstable_Grid2/Grid2';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { useCallback, useState } from 'react';
import { useBlockShuffle } from '../../hooks/programming_controls/useBlockShuffle.ts';
import {
  StartTimePadding,
  StartTimePaddingOptions,
  usePadStartTimes,
} from '../../hooks/programming_controls/usePadStartTimes.ts';
import {
  deleteProgram,
  resetLineup,
  setChannelStartTime,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import AddRedirectModal from '../programming_controls/AddRedirectModal.tsx';
import ProgrammingSelector from './ProgrammingSelector.tsx';
import AddFlexModal from '../programming_controls/AddFlexModal.tsx';

// dayjs.extend(duration);

export function ChannelProgrammingConfig() {
  const channel = useStore((s) => s.channelEditor.currentChannel);
  const [programmingModalOpen, setProgrammingModalOpen] = useState(false);
  const programList = useStore((s) => s.channelEditor.programList);
  const programsDirty = useStore((s) => s.channelEditor.dirty.programs);

  const [addRedirectModalOpen, setAddRedirectModalOpen] = useState(false);
  const [addFlexModalOpen, setAddFlexModalOpen] = useState(false);

  // const [{isDragging}, drag] =
  // const [, drop] = useDrop(() => ({
  //   accept: 'all'
  // }));

  const blockShuffle = useBlockShuffle();
  const [currentPadding, setCurrentPadding] = useState<StartTimePadding | null>(
    null,
  );
  const padStartTimes = usePadStartTimes();

  const deleteProgramAtIndex = useCallback((idx: number) => {
    deleteProgram(idx);
  }, []);

  const renderPrograms = () => {
    let lastStart = dayjs(channel!.startTime);
    return programList.map((p, idx) => {
      const startTime = lastStart.format('YYYY-MM-DD HH:mm:ss');
      const nextStart = lastStart.add(p.duration, 'milliseconds');
      console.log(
        nextStart.format(),
        lastStart.format(),
        nextStart.isAfter(lastStart),
      );
      const dayBoundary = nextStart.isAfter(lastStart, 'day');
      lastStart = nextStart;
      let title: string;

      switch (p.type) {
        case 'custom':
          title = 'custom...';
          break;
        case 'redirect':
          title = 'redirect...';
          break;
        case 'flex':
          title = 'Flex';
          break;
        case 'content':
          if (p.episodeTitle) {
            title = `${p.title} - ${p.episodeTitle}`;
          } else {
            title = p.title;
          }
          break;
      }

      const dur = dayjs.duration({ milliseconds: p.duration }).humanize();

      title = `${startTime} ${title} (${dur})`;

      return (
        <ListItem
          key={startTime}
          sx={{ borderBottom: dayBoundary ? '1px dashed black' : null }}
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

  const handleStartTimeChange = (value: string) => {
    setChannelStartTime(dayjs(value).unix() * 1000);
  };

  const startTime = channel ? dayjs(channel.startTime) : dayjs();
  const endTime = startTime.add(channel?.duration ?? 0, 'milliseconds');

  return (
    <Box display="flex" flexDirection="column">
      <Box sx={{ mb: 2 }}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Controls</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid2 container spacing={2}>
              <Grid2 xs={6}>
                <FormGroup row>
                  <TextField size="small" variant="outlined" />
                  <FormControlLabel control={<Checkbox />} label="Randomize" />
                  <Button
                    variant="contained"
                    disableElevation
                    sx={{ textTransform: 'none' }}
                    startIcon={<ShuffleIcon />}
                    onClick={() => blockShuffle()}
                  >
                    Block Shuffle
                  </Button>
                </FormGroup>
              </Grid2>
              <Grid2 xs={3}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<ShuffleIcon />}
                >
                  Random
                </Button>
              </Grid2>
              <Grid2 xs={3}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<ShuffleIcon />}
                >
                  Cyclic
                </Button>
              </Grid2>
              <Grid2 xs={3}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SortByAlphaIcon />}
                >
                  Alphabetically
                </Button>
              </Grid2>
              <Grid2 xs={3}>
                <Button fullWidth variant="contained" startIcon={<SortIcon />}>
                  Release Date
                </Button>
              </Grid2>
              <Grid2 xs={6}>
                <FormGroup row>
                  <FormControl fullWidth>
                    <InputLabel>Pad Start Times</InputLabel>
                    <Select
                      value={currentPadding?.mod ?? -1}
                      label={'Pad Start Times'}
                      onChange={(e) =>
                        setCurrentPadding(
                          e.target.value === -1
                            ? null
                            : StartTimePaddingOptions.find(
                                (opt) => opt.mod === e.target.value,
                              )!,
                        )
                      }
                    >
                      {StartTimePaddingOptions.map((opt, idx) => (
                        <MenuItem key={idx} value={opt.mod}>
                          {opt.description}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<SortIcon />}
                    onClick={() => padStartTimes(currentPadding)}
                  >
                    Pad Times
                  </Button>
                </FormGroup>
              </Grid2>
              <Grid2 xs={3}>
                <Button
                  onClick={() => setAddFlexModalOpen(true)}
                  variant="contained"
                  startIcon={<CloudOffIcon />}
                >
                  Add Flex
                </Button>
              </Grid2>
              <Grid2 xs={3}>
                <Button
                  variant="contained"
                  onClick={() => setAddRedirectModalOpen(true)}
                >
                  Add Redirect
                </Button>
              </Grid2>
            </Grid2>
          </AccordionDetails>
        </Accordion>
      </Box>
      <AddFlexModal
        open={addFlexModalOpen}
        onClose={() => setAddFlexModalOpen(false)}
      />
      <AddRedirectModal
        open={addRedirectModalOpen}
        onClose={() => setAddRedirectModalOpen(false)}
      />
      <Paper sx={{ p: 2 }}>
        <Box display="flex">
          <FormControl margin="normal" sx={{ flex: 1, mr: 2 }}>
            <InputLabel>Programming Start</InputLabel>
            <Input
              type="datetime-local"
              value={startTime.format('YYYY-MM-DDTHH:mm:ss')}
              onChange={(e) => handleStartTimeChange(e.target.value)}
            />
          </FormControl>
          <FormControl margin="normal" sx={{ flex: 1 }}>
            <InputLabel>Programming End</InputLabel>
            <Input
              disabled
              type="datetime-local"
              value={endTime.format('YYYY-MM-DDTHH:mm:ss')}
            />
          </FormControl>
        </Box>
        <Box>
          <Button
            variant="contained"
            onClick={() => resetLineup()}
            disabled={!programsDirty}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            onClick={() => setProgrammingModalOpen(true)}
          >
            Add
          </Button>
        </Box>
        <Box display="flex">
          <Box sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
            <List dense>{renderPrograms()}</List>
          </Box>
        </Box>
      </Paper>
      <ProgrammingSelector
        open={programmingModalOpen}
        onClose={() => setProgrammingModalOpen(false)}
      />
    </Box>
  );
}
