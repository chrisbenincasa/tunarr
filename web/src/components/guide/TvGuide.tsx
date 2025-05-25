import { useCopyToClipboard } from '@/hooks/useCopyToClipboard.ts';
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
  MenuItem,
  styled,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from '@tanstack/react-router';
import type { Channel } from '@tunarr/types';
import { type ChannelLineup, type TvGuideProgram } from '@tunarr/types';
import Color from 'colorjs.io';
import dayjs, { type Dayjs } from 'dayjs';
import { compact, isEmpty, isNull, isUndefined, map, round } from 'lodash-es';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { match, P } from 'ts-pattern';
import { useInterval } from 'usehooks-ts';
import { alternateColors, isNonEmptyString } from '../../helpers/util';
import { useRandomProgramBackgroundColor } from '../../hooks/colorHooks.ts';
import { useChannelsSuspense } from '../../hooks/useChannels.ts';
import { useServerEvents } from '../../hooks/useServerEvents.ts';
import { useTvGuides, useTvGuidesPrefetch } from '../../hooks/useTvGuide';
import { useSettings } from '../../store/settings/selectors.ts';
import ProgramDetailsDialog from '../ProgramDetailsDialog';
import TunarrLogo from '../TunarrLogo';
import PaddedPaper from '../base/PaddedPaper';
import { StyledMenu } from '../base/StyledMenu.tsx';

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

const GuideItem = styled(GridChild, {
  shouldForwardProp: (prop) => prop !== 'backgroundColor' && prop !== 'program',
})<{
  program?: TvGuideProgram;
  backgroundColor?: Color;
  width: number;
  index: number;
}>(({ theme, width, index, backgroundColor, program }) => {
  const bgColor =
    backgroundColor?.toString({ format: 'hex' }) ??
    alternateColors(index, theme.palette.mode);
  const bgLighter = new Color(bgColor).set('oklch.l', (l) => l * 1.05);
  const bgDarker = new Color(bgColor).set('oklch.l', (l) => l * 0.95);

  const background =
    isUndefined(program) || program.type === 'flex' || program.isPaused
      ? `repeating-linear-gradient(-45deg,
              ${bgColor},
              ${bgColor} 10px,
              ${bgDarker.toString()} 10px,
              ${bgDarker.toString()} 20px)`
      : bgColor;

  const hoverBackground =
    isUndefined(program) || program.type === 'flex' || program.isPaused
      ? `repeating-linear-gradient(-45deg,
  ${bgLighter.toString()},
  ${bgLighter.toString()} 10px,
  ${bgColor} 10px,
  ${bgColor} 20px)`
      : bgLighter.toString();

  return {
    display: 'flex',
    alignItems: 'flex-start',
    background,
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
      background: hoverBackground,
      // color: getTextContrast(bgLighter, theme.palette.mode),
    },
  };
});

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

  const [channelMenu, setChannelMenu] = useState<Channel>();

  const [progress, setProgress] = useState(calcProgress(start, end));
  const [currentTime, setCurrentTime] = useState(dayjs().format('LT'));

  const [modalProgram, setModalProgram] = useState<
    TvGuideProgram | undefined
  >();

  const queryClient = useQueryClient();
  const { addListener, removeListener } = useServerEvents();

  const copyToClipboard = useCopyToClipboard();

  const handleModalOpen = useCallback((program: TvGuideProgram | undefined) => {
    if (program && program.type === 'flex') {
      return;
    }

    setModalProgram(program);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalProgram(undefined);
  }, []);

  useEffect(() => {
    const key = addListener((ev) => {
      if (ev.type === 'xmltv') {
        queryClient
          .invalidateQueries({
            // Gnarly
            predicate: (query) =>
              query.queryKey?.[0] === 'channels' &&
              query.queryKey?.[2] === 'guide',
          })
          .catch(console.error);
      }
    });
    return () => removeListener(key);
  }, [addListener, queryClient, removeListener]);

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
    channel: Channel,
  ) => {
    setAnchorEl(event.currentTarget);
    setChannelMenu(channel);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    setProgress(calcProgress(start, end));
    setCurrentTime(dayjs().format('LT'));
    if (ref.current) {
      setMinHeight(ref.current.offsetHeight);
    }
  }, [start, end]);

  useInterval(() => {
    setProgress(calcProgress(start, end));
    setCurrentTime(dayjs().format('LT'));
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

  const { data: channelsInfo } = useChannelsSuspense();

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
          onClick={() => {
            copyToClipboard(channelMenu.id).catch(console.error);
            setAnchorEl(null);
          }}
        >
          <EditIcon />
          Copy Channel ID
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
          target="_blank"
          href={`${backendUri}/stream/channels/${channelMenu.number}.m3u8`}
          component="a"
        >
          <TextSnippet />
          M3U Link
        </MenuItem>
      </StyledMenu>
    ) : null;
  };

  const randomBackgroundColor = useRandomProgramBackgroundColor();

  const renderProgram = ({
    id: channelId,
    name: channelName,
  }: ChannelLineup) => {
    const configuredFuideFlexTitle = channelsInfo.find(
      (c) => c.id === channelId,
    )?.guideFlexTitle;
    const flexTitle = isNonEmptyString(configuredFuideFlexTitle)
      ? configuredFuideFlexTitle
      : channelName;
    return (
      program: TvGuideProgram,
      index: number,
      lineup: TvGuideProgram[],
    ) => {
      const title = match(program)
        .with(
          { type: 'content', grandparent: { title: P.nonNullable } },
          ({ grandparent }) => grandparent.title,
        )
        .with({ type: 'content' }, (p) => p.title)
        .with(
          { type: 'custom', program: { title: P.nonNullable } },
          ({ program: { title } }) => title,
        )
        .with({ type: 'custom' }, () => 'Custom Program')
        .with({ type: 'redirect' }, (p) => `Redirect to Channel ${p.channel}`)
        .with({ type: 'flex' }, (p) => p.title ?? flexTitle)
        .exhaustive();

      const episodeTitle = match(program)
        .with(
          { type: 'custom', program: { subtype: 'movie' } },
          ({ program }) =>
            compact([program.date ? dayjs(program.date).year() : null]).join(
              ',',
            ),
        )
        .with(
          { type: 'custom', program: P.nonNullable },
          ({ program }) => program.title,
        )
        .with({ type: 'custom' }, () => '')
        .with({ type: 'content', subtype: 'movie' }, (p) =>
          compact([p.date ? dayjs(p.date).year() : null]).join(','),
        )
        .with({ type: 'content' }, (p) => p.title)
        .otherwise(() => '');

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
        ((+timelineDuration - totalProgramDuration) / +timelineDuration) *
          100.0,
        2,
      );

      const pct = round((+duration / +timelineDuration) * 100.0, 2);

      const isPlaying = dayjs().isBetween(programStart, programEnd);
      let remainingTime: number = 0;

      if (isPlaying && !program.isPaused) {
        remainingTime = programEnd.diff(dayjs(), 'm');
      } else if (program.isPaused && !isUndefined(program.timeRemaining)) {
        remainingTime = round(
          dayjs.duration(program.timeRemaining).asMinutes(),
        );
      }

      const bg = randomBackgroundColor(program);

      return (
        <Fragment key={key}>
          <GuideItem
            width={pct}
            index={index}
            onClick={() => handleModalOpen(program)}
            backgroundColor={bg}
            program={program}
          >
            <Box sx={{ fontSize: '14px', fontWeight: '600' }}>{title}</Box>
            <Box sx={{ fontSize: '13px', fontStyle: 'italic' }}>
              {episodeTitle}
            </Box>
            {(smallViewport && pct > 20) ||
              (!smallViewport && pct > 8 && (
                <>
                  {!program.isPaused && (
                    <Box sx={{ fontSize: '12px' }}>
                      {`${programStart.format('LT')} - ${programEnd.format('LT')}`}
                    </Box>
                  )}
                  <Box sx={{ fontSize: '12px' }}>
                    {remainingTime ? ` (${remainingTime}m left)` : null}
                  </Box>
                </>
              ))}
          </GuideItem>
          {endOfAvailableProgramming
            ? renderUnavailableProgramming(finalBlockWidth, index)
            : null}
        </Fragment>
      );
    };
  };

  const renderUnavailableProgramming = (width: number, index: number) => {
    const bg = alternateColors(index, theme.palette.mode);
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
              ${bg},
              ${bg} 10px,
              ${bg} 10px,
              ${bg} 20px)`,
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
    const flexPlaceholderTitle =
      channelsInfo.find((c) => c.id === lineup.id)?.guideFlexTitle ??
      lineup.name;
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
        title: flexPlaceholderTitle,
        isPaused: false,
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
          ? alignedLineup.map(renderProgram(lineup))
          : renderUnavailableProgramming(100, index)}
      </Box>
    );
  });

  return (
    <PaddedPaper
      sx={{
        width: 'inherit',
        minHeight: minHeight >= 0 ? minHeight : undefined,
      }}
    >
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
          sx={{ maxWidth: `${smallViewport ? '10%' : '15%'}` }}
        >
          <Box sx={{ height: '4rem' }}></Box>
          {channelsInfo.map((channel) => (
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
                <span>{smallViewport ? channel.number : channel.name}</span>
              </StyledButton>
              {renderChannelMenu()}
            </Box>
          ))}
        </Box>
        <Box
          sx={{
            overflowX: 'auto',
            overflowY: 'hidden',
            width: isPending ? '100%' : undefined,
            flex: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              position: 'relative',
              flexDirection: 'column',
              width: isPending ? '100%' : 'fit-content',
              height: isPending ? '100%' : undefined,
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
                    borderLeft: '1px solid white',
                    textAlign: 'center',
                    '&:last-child': {
                      borderRight: '1px solid white',
                    },
                  }}
                  key={slot}
                >
                  {start
                    .add(slot * increments, 'minutes')
                    .format(`${smallViewport ? 'h:mm' : 'LT'}`)}
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
                  alignItems: 'center',
                  flexBasis: '100%',
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
                  left: `${progress}%`,
                  transition: 'left 0.5s linear',
                  height: '100%',
                  zIndex: 10,
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    background: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    minWidth: '50px',
                    width: 'max-content',
                    px: 1,
                    borderRadius: '5px',
                    fontSize: '14px',
                    textAlign: 'center',
                    zIndex: 2,
                    marginLeft: '-50%',
                  }}
                >
                  {currentTime}
                </Box>
                <Box
                  sx={{
                    position: 'relative',
                    top: '-18px',
                    width: '2px',
                    background: theme.palette.primary.main,
                    height: '100%',
                    mt: '-2px',
                  }}
                ></Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </PaddedPaper>
  );
}
