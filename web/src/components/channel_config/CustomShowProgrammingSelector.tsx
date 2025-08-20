import { betterHumanize } from '@/helpers/dayjs.ts';
import { useProgramTitleFormatter } from '@/hooks/useProgramTitleFormatter.ts';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { seq } from '@tunarr/shared/util';
import { isCustomProgram, type CustomShow } from '@tunarr/types';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { isEmpty, isUndefined, map } from 'lodash-es';
import pluralize from 'pluralize';
import { Fragment, useCallback, useState, type MouseEvent } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import { toggle } from '../../helpers/util';
import {
  customShowProgramsQuery,
  useCustomShows,
} from '../../hooks/useCustomShows';
import useStore from '../../store';
import { addSelectedMedia } from '../../store/programmingSelector/actions';
import SelectedProgrammingActions from './SelectedProgrammingActions.tsx';

dayjs.extend(duration);

type CustomShowListItemProps = {
  customShow: CustomShow;
  selectShow: (show: CustomShow) => Promise<void>;
};

type Props = {
  toggleOrSetSelectedProgramsDrawer: (open: boolean) => void;
};

function CustomShowListItem({
  customShow,
  selectShow,
}: CustomShowListItemProps) {
  const formatter = useProgramTitleFormatter();
  const [open, setOpen] = useState(false);

  const { data: programs, isPending: programsLoading } = useQuery({
    ...customShowProgramsQuery(customShow.id),
    enabled: open,
  });

  const renderPrograms = () => {
    if (programsLoading) {
      return <LinearProgress />;
    } else if (!isUndefined(programs) && !isEmpty(programs)) {
      return seq.collect(
        programs.filter(
          (program) =>
            isCustomProgram(program) && program.persisted && program.program,
        ),
        (program) => {
          return (
            <ListItem divider dense key={program.id} sx={{ pl: 4 }}>
              <ListItemText
                primary={formatter(program)}
                secondary={betterHumanize(dayjs.duration(program.duration))}
              />
            </ListItem>
          );
        },
      );
    }

    return null;
  };

  const onClick = useCallback(
    async (e: MouseEvent<HTMLButtonElement>, show: CustomShow) => {
      e.stopPropagation();
      await selectShow(show);
    },
    [selectShow],
  );

  return (
    <Fragment key={customShow.id}>
      <ListItemButton dense onClick={() => setOpen(toggle)}>
        <Tooltip
          title={
            !open
              ? 'Click to preview the items in this Custom Show. Note that only the whole show can be added at once.'
              : ''
          }
          placement="top"
        >
          <ListItemIcon>{open ? <ExpandLess /> : <ExpandMore />}</ListItemIcon>
        </Tooltip>
        <ListItemText
          // TODO add season and episode number?
          primary={customShow.name}
          secondary={`${customShow.contentCount} ${pluralize(
            'Program',
            customShow.contentCount,
          )}`}
        />
        <Button onClick={(e) => onClick(e, customShow)} variant="contained">
          Add Show
        </Button>
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
        {renderPrograms()}
      </Collapse>
      <Divider variant="fullWidth" />
    </Fragment>
  );
}

export function CustomShowProgrammingSelector({
  toggleOrSetSelectedProgramsDrawer,
}: Props) {
  const { data: customShows, isPending } = useCustomShows();
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });
  const queryClient = useQueryClient();

  const isLoading = isPending;

  const { ref } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting && scrollParams.limit < scrollParams.max) {
        setScrollParams(({ limit: prevLimit, max }) => ({
          max,
          limit: prevLimit + 10,
        }));
      }
    },
    threshold: 0.5,
  });

  const selectShow = useCallback(
    async (show: CustomShow) => {
      try {
        const customShowPrograms = await queryClient.ensureQueryData(
          customShowProgramsQuery(show.id),
        );
        addSelectedMedia({
          type: 'custom-show',
          customShowId: show.id,
          childCount: show.contentCount,
          totalDuration: show.totalDuration,
          programs: customShowPrograms,
        });
      } catch (e) {
        console.error('Error fetching custom show programs', e);
      }
    },
    [queryClient],
  );

  const renderListItems = () => {
    return map(customShows, (cs) => {
      return (
        <CustomShowListItem
          key={cs.id}
          customShow={cs}
          selectShow={() => selectShow(cs)}
        />
      );
    });
  };

  return (
    <Box>
      <LinearProgress
        sx={{
          visibility: isLoading ? 'visible' : 'hidden',
          height: 10,
          marginTop: 1,
        }}
      />

      <SelectedProgrammingActions
        toggleOrSetSelectedProgramsDrawer={toggleOrSetSelectedProgramsDrawer}
      />
      <List
        component="nav"
        sx={{
          mt: 2,
          width: '100%',
          maxHeight: 1200,
          overflowY: 'scroll',
          display: viewType === 'grid' ? 'flex' : 'block',
          flexWrap: 'wrap',
          gap: '10px',
          justifyContent: 'space-between',
        }}
      >
        {renderListItems()}
        <div style={{ height: 40 }} ref={ref}></div>
      </List>
      <Divider sx={{ mt: 3, mb: 2 }} />
    </Box>
  );
}
