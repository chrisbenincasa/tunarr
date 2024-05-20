import {
  Dvr as ProgrammingIcon,
  TextSnippet,
  PlayArrow as WatchIcon,
} from '@mui/icons-material';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Box,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  MenuProps,
  Tooltip,
  Typography,
  alpha,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ChannelLineup, TvGuideProgram } from '@tunarr/types';
import dayjs, { Dayjs } from 'dayjs';
import { isEmpty, isNull, isUndefined, map, round } from 'lodash-es';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useInterval } from 'usehooks-ts';
import { alternateColors, forTvGuideProgram } from '../../helpers/util';
import { useTvGuides, useTvGuidesPrefetch } from '../../hooks/useTvGuide';
import { useSettings } from '../../store/settings/selectors.ts';
import ProgramDetailsDialog from '../ProgramDetailsDialog';
import TunarrLogo from '../TunarrLogo';
import PaddedPaper from '../base/PaddedPaper';

const StyledMenu = styled((props: MenuProps) => (
  <Menu
    elevation={0}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'right',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'right',
    }}
    {...props}
  />
))(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    backgroundColor: theme.palette.background.paper,
    boxShadow:
      'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    '& .MuiMenu-list': {
      padding: '4px 0',
    },
    '& .MuiMenuItem-root': {
      '& .MuiSvgIcon-root': {
        fontSize: 18,
        marginRight: theme.spacing(1.5),
      },
      '&:active': {
        backgroundColor: alpha(
          theme.palette.primary.main,
          theme.palette.action.selectedOpacity,
        ),
      },
    },
  },
}));

const GridParent = styled(Box)({
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderWidth: '1px 0 0 1px',
});

const GridChild = styled(Box)<{ width: number }>(({ width }) => ({
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderWidth: '0 1px 0 0',
  width: `${width}%`,
  transition: 'width 0.5s ease-in',
}));

const GuideItem = styled(GridChild)<{ width: number; index: number }>(
  ({ theme, width, index }) => ({
    display: 'flex',
    alignItems: 'flex-start',
    backgroundColor: alternateColors(index, theme.palette.mode, theme),
    borderCollapse: 'collapse',
    borderStyle: 'solid',
    borderWidth: '2px 5px 2px 5px',
    borderColor: 'transparent',
    borderRadius: '5px',
    margin: 1,
    padding: 1,
    height: '4rem',
    width: `${width}%`,
    transition: 'width 0.5s ease-in',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    cursor: 'pointer',
    '&:hover': {
      background: theme.palette.primary.light,
      color: theme.palette.primary.contrastText,
    },
  }),
);

const StyledButton = styled(Button)`
  & .MuiButton-endIcon {
    flex-grow: 1;
    justify-content: flex-end;
  }
`;

const calcProgress = (start: Dayjs, end: Dayjs): number => {
  const total = end.unix() - start.unix();
  const p = dayjs().unix() - start.unix();
  return round(100 * (p / total), 2);
};

type Props = {
  channelId: string;
  start: Dayjs;
  end: Dayjs;
};

export function TvGuide({ channelId, start, end }: Props) {
  const theme = useTheme();
  const { backendUri } = useSettings();

  // Workaround for issue with page jumping on-zoom or nav caused by collapsing
  // div when loading new guide data
  const ref = useRef<HTMLDivElement | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = !isNull(anchorEl);
  const [minHeight, setMinHeight] = useState(0);
  const smallViewport = useMediaQuery(theme.breakpoints.down('md'));

  const [channelMenu, setChannelMenu] = useState<ChannelLineup>();

  const [progress, setProgress] = useState(calcProgress(start, end));
  const [currentTime, setCurrentTime] = useState(dayjs().format('h:mm'));

  const [modalProgram, setModalProgram] = useState<
    TvGuideProgram | undefined
  >();

  const handleModalOpen = useCallback((program: TvGuideProgram | undefined) => {
    if (program && program.type === 'flex') {
      return;
    }

    setModalProgram(program);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalProgram(undefined);
  }, []);

  const timelineDuration = dayjs.duration(end.diff(start));
  const increments =
    timelineDuration.asMilliseconds() <
    dayjs.duration(4, 'hour').asMilliseconds()
      ? 30
      : 60;
  const intervalArray = Array.from(
    Array(timelineDuration.asMinutes() / increments).keys(),
  );

  const handleClick = (
    event: React.MouseEvent<HTMLElement>,
    channel: ChannelLineup,
  ) => {
    setAnchorEl(event.currentTarget);
    setChannelMenu(channel);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    setProgress(calcProgress(start, end));
    setCurrentTime(dayjs().format('h:mm'));
    if (ref.current) {
      setMinHeight(ref.current.offsetHeight);
    }
  }, [start, end]);

  useInterval(() => {
    setProgress(calcProgress(start, end));
    setCurrentTime(dayjs().format('h:mm'));
  }, 60000);

  useTvGuidesPrefetch(
    channelId,
    {
      from: start.add(1, 'hour'),
      to: end.add(1, 'hour'),
    },
    { staleTime: dayjs.duration(5, 'minutes').asMilliseconds() },
  );

  const {
    isPending,
    error,
    data: channelLineup,
  } = useTvGuides(
    channelId,
    { from: start, to: end },
    { staleTime: dayjs.duration(5, 'minutes').asMilliseconds() },
  );

  useEffect(() => {
    if (ref.current) {
      setMinHeight(ref.current.offsetHeight);
    }
  }, [channelLineup]);

  const renderChannelMenu = () => {
    return channelMenu ? (
      <StyledMenu
        id="channel-nav-menu"
        MenuListProps={{
          'aria-labelledby': 'channel-nav-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem
          disableRipple
          to={`/channels/${channelMenu.id}/edit`}
          component={RouterLink}
        >
          <EditIcon />
          Edit Channel
        </MenuItem>
        <MenuItem
          disableRipple
          to={`/channels/${channelMenu.id}/programming`}
          component={RouterLink}
        >
          <ProgrammingIcon />
          Modify Programing
        </MenuItem>
        <MenuItem
          disableRipple
          to={`/channels/${channelMenu.id}/watch`}
          component={RouterLink}
        >
          <WatchIcon />
          Watch Channel
        </MenuItem>
        <MenuItem
          disableRipple
          to={`${backendUri}/media-player/${channelMenu.number}.m3u`}
          component={RouterLink}
        >
          <TextSnippet />
          M3U Link
        </MenuItem>
      </StyledMenu>
    ) : null;
  };

  const renderProgram = (
    program: TvGuideProgram,
    index: number,
    lineup: TvGuideProgram[],
  ) => {
    const title = forTvGuideProgram({
      content: (p) => p.title,
      custom: (p) => p.program?.title ?? 'Custom Program',
      redirect: (p) => `Redirect to Channel ${p.channel}`,
      flex: 'Flex',
    })(program);

    const episodeTitle = forTvGuideProgram({
      custom: (p) => p.program?.episodeTitle ?? '',
      content: (p) => p.episodeTitle,
      default: '',
    })(program);

    const key = `${title}_${program.start}_${program.stop}`;
    const programStart = dayjs(program.start);
    const programEnd = dayjs(program.stop);
    let duration = dayjs.duration(programEnd.diff(programStart));
    let endOfAvailableProgramming = false;

    // Trim any time that has already played from the currently playing program
    if (index === 0) {
      const trimStart = start.diff(programStart);
      duration = duration.subtract(trimStart, 'ms');
    }

    // Calc for final program in lineup
    if (index === lineup.length - 1) {
      // If program goes beyond current guide duration, trim it so we get accurate program durations
      if (programEnd.isAfter(end)) {
        const trimEnd = programEnd.diff(end);
        duration = duration.subtract(trimEnd, 'ms');
      }

      if (programEnd.isBefore(end)) {
        endOfAvailableProgramming = true;
      }
    }

    // Calculate the total duration of programming in the lineup
    // This allows us to properly calculate the width of injected 'no programming available' blocks
    const totalProgramDuration = lineup.reduce(
      (totalDuration, currentProgram, index) => {
        const programStart = dayjs(currentProgram.start);
        const programEnd = dayjs(currentProgram.stop);
        let duration = dayjs.duration(programEnd.diff(programStart));

        if (index === 0 && programStart.isBefore(start)) {
          const trimStart = start.diff(programStart);
          duration = duration.subtract(trimStart, 'ms');
        }

        if (index === lineup.length - 1 && programEnd.isAfter(end)) {
          const trimEnd = programEnd.diff(end);
          duration = duration.subtract(trimEnd, 'ms');
        }

        return totalDuration + duration.asMilliseconds();
      },
      0,
    );

    const finalBlockWidth = round(
      ((timelineDuration.asMilliseconds() - totalProgramDuration) /
        timelineDuration.asMilliseconds()) *
        100.0,
      2,
    );

    const pct = round(
      (duration.asMilliseconds() / timelineDuration.asMilliseconds()) * 100.0,
      2,
    );

    const isPlaying = dayjs().isBetween(programStart, programEnd);
    let remainingTime;

    if (isPlaying) {
      remainingTime = programEnd.diff(dayjs(), 'm');
    }

    return (
      <Fragment key={key}>
        <GuideItem
          width={pct}
          index={index}
          onClick={() => handleModalOpen(program)}
        >
          <Box sx={{ fontSize: '14px', fontWeight: '600' }}>{title}</Box>
          <Box sx={{ fontSize: '13px', fontStyle: 'italic' }}>
            {episodeTitle}
          </Box>
          {((smallViewport && pct > 20) || (!smallViewport && pct > 8)) && (
            <>
              <Box sx={{ fontSize: '12px' }}>
                {`${programStart.format('h:mm')} - ${programEnd.format(
                  'h:mma',
                )}`}
              </Box>
              <Box sx={{ fontSize: '12px' }}>
                {isPlaying ? ` (${remainingTime}m left)` : null}
              </Box>
            </>
          )}
        </GuideItem>
        {endOfAvailableProgramming
          ? renderUnavailableProgramming(finalBlockWidth, index)
          : null}
      </Fragment>
    );
  };

  const renderUnavailableProgramming = (width: number, index: number) => {
    return (
      <Tooltip
        title={'No programming scheduled for this time period'}
        placement="top"
      >
        <GuideItem
          width={width}
          index={index}
          sx={{
            border: 'none',
            background: `repeating-linear-gradient(
              45deg,
              ${alternateColors(index, theme.palette.mode, theme)},
              ${alternateColors(index, theme.palette.mode, theme)} 10px,
              ${alternateColors(index, theme.palette.mode, theme)} 10px,
              ${alternateColors(index, theme.palette.mode, theme)} 20px)`,
          }}
        >
          <Box
            sx={{
              fontSize: '14px',
              fontWeight: '600',
              m: 0.5,
            }}
          >
            No Programming scheduled
          </Box>
        </GuideItem>
      </Tooltip>
    );
  };

  const channels = map(channelLineup, (lineup, index) => {
    const alignedLineup = lineup.programs;
    if (
      lineup.programs.length > 0 &&
      start.isBefore(lineup.programs[0].start)
    ) {
      // TODO: This seems to happen when the server is started
      // and generates a guide _after_ the start time of the page
      // When this happens, we don't know what happened before this
      // program, so we should just insert some filler.
      // We can look into generating the _previous_ hour's (just say)
      // programming on server startup, but out of scope for right now.
      const startUnix = start.unix() * 1000;
      const fillerLength = lineup.programs[0].start - startUnix;
      alignedLineup.unshift({
        type: 'flex',
        persisted: false,
        duration: fillerLength,
        start: startUnix,
        stop: lineup.programs[0].start,
      });
    }
    return (
      <Box
        key={lineup.id}
        component="section"
        sx={{
          display: 'flex',
          flex: 1,
          borderStyle: 'solid',
          borderColor: 'transparent',
        }}
      >
        {alignedLineup.length > 0
          ? alignedLineup.map(renderProgram)
          : renderUnavailableProgramming(100, index)}
      </Box>
    );
  });

  return (
    <PaddedPaper sx={{ minHeight: minHeight >= 0 ? minHeight : undefined }}>
      <ProgramDetailsDialog
        open={!isUndefined(modalProgram)}
        onClose={() => handleModalClose()}
        program={modalProgram}
        start={dayjs(modalProgram?.start)}
        stop={dayjs(modalProgram?.stop)}
      />
      <Box display="flex" ref={ref}>
        <Box
          display="flex"
          position="relative"
          flexDirection="column"
          sx={{ width: `${smallViewport ? '10%' : '15%'}` }}
        >
          <Box sx={{ height: '4rem' }}></Box>
          {channelLineup?.map((channel) => (
            <Box
              sx={{ height: '4rem' }}
              key={channel.number}
              display={'flex'}
              flexGrow={1}
            >
              <StyledButton
                id="channel-nav-button"
                aria-controls={open ? 'channel-nav-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                variant="text"
                color="inherit"
                disableRipple
                disableElevation
                startIcon={
                  isEmpty(channel.icon?.path) ? (
                    <TunarrLogo style={{ width: '40px' }} />
                  ) : (
                    <img style={{ width: '40px' }} src={channel.icon?.path} />
                  )
                }
                onClick={(event) => handleClick(event, channel)}
                endIcon={<KeyboardArrowDownIcon />}
                fullWidth
                sx={{
                  textAlign: 'left',
                  lineHeight: '1.25',
                }}
              >
                {smallViewport ? channel.number : channel.name}
              </StyledButton>
              {renderChannelMenu()}
            </Box>
          ))}
        </Box>
        <Box
          sx={{
            display: 'flex',
            position: 'relative',
            flexDirection: 'column',
            width: `${smallViewport ? '90%' : '85%'}`,
          }}
        >
          <Box
            sx={{
              width: `100%`,
              height: '2rem',
              textAlign: 'center',
              fontWeight: 'bold',
            }}
          >
            {start.format('MMMM D')}
          </Box>
          <GridParent
            sx={{
              display: 'flex',
              flex: 1,
            }}
          >
            {intervalArray.map((slot) => (
              <GridChild
                width={100 / intervalArray.length}
                sx={{
                  height: '2rem',
                }}
                key={slot}
              >
                {start
                  .add(slot * increments, 'minutes')
                  .format(`${smallViewport ? 'h:mm' : 'h:mm A'}`)}
              </GridChild>
            ))}
          </GridParent>
          {error ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                marginLeft: '-250px',
                my: 2,
              }}
            >
              <Typography sx={{ m: 4 }}>
                An error occurred: {error.message}
              </Typography>
            </Box>
          ) : isPending ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                marginLeft: '-250px',
                my: 2,
              }}
            >
              <CircularProgress color="secondary" sx={{ m: 4 }} />
            </Box>
          ) : (
            channels
          )}
          {dayjs().isBetween(start, end) && (
            <Box
              sx={{
                position: 'absolute',
                width: '2px',
                background: theme.palette.primary.main,
                zIndex: 10,
                height: '100%',
                left: `${progress}%`,
                top: '-2px',
                transition: 'left 0.5s linear',
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  left: '-25px',
                  background: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  width: '50px',
                  borderRadius: '5px',
                  fontSize: '14px',
                  textAlign: 'center',
                }}
              >
                {currentTime}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </PaddedPaper>
  );
}
