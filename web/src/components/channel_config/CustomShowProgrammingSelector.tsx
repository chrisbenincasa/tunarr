import {
  Box,
  Button,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { forProgramType } from '@tunarr/shared/util';
import { CustomProgram, isCustomProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { chain, flow, isEmpty, isNil, negate } from 'lodash-es';
import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import { typedProperty } from '../../helpers/util';
import { useCustomShow } from '../../hooks/useCustomShows';
import useStore from '../../store';
import { addSelectedMedia } from '../../store/programmingSelector/actions';

dayjs.extend(duration);

export function CustomShowProgrammingSelector() {
  const selectedCustomShow = useStore((s) =>
    s.currentLibrary?.type === 'custom-show' ? s.currentLibrary : null,
  );
  const viewType = useStore((state) => state.theme.programmingSelectorView);
  const [scrollParams, setScrollParams] = useState({ limit: 0, max: -1 });

  const [showResult, programsResult] = useCustomShow(
    /*id=*/ selectedCustomShow?.library.id ?? '',
    /*enabled=*/ !isNil(selectedCustomShow),
    /*includePrograms=*/ true,
  );

  const isLoading = showResult.isLoading || programsResult.isLoading;

  const formattedTitle = useMemo(
    () =>
      forProgramType({
        content: (p) => p.title,
        custom: (p) => p.program!.title,
      }),
    [],
  );

  const formattedEpisodeTitle = useMemo(
    () =>
      forProgramType({
        custom: (p) => p.program?.episodeTitle ?? '',
      }),
    [],
  );

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

  const handleItem = useCallback(
    (e: MouseEvent<HTMLButtonElement>, item: CustomProgram) => {
      e.stopPropagation();
      if (selectedCustomShow) {
        addSelectedMedia({
          type: 'custom-show',
          customShowId: selectedCustomShow.library.id,
          program: item,
          childCount: selectedCustomShow.library.contentCount,
        });
      }
    },
    [selectedCustomShow],
  );

  const renderListItems = () => {
    if (
      showResult.data &&
      programsResult.data &&
      programsResult.data.length > 0
    ) {
      return chain(programsResult.data)
        .filter(isCustomProgram)
        .filter(typedProperty('persisted'))
        .filter(flow(typedProperty('program'), negate(isNil)))
        .map((program) => {
          let title = formattedTitle(program);
          const epTitle = formattedEpisodeTitle(program);
          if (!isEmpty(epTitle)) {
            title += ` - ${epTitle}`;
          }

          return (
            <ListItem dense key={program.id}>
              <ListItemText
                // TODO add season and episode number?
                primary={title}
                secondary={dayjs.duration(program.duration).humanize()}
              />
              <Button
                onClick={(e) => handleItem(e, program)}
                variant="contained"
              >
                Add
              </Button>
            </ListItem>
          );
        })
        .compact()
        .value();
    }

    return null;
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
