import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Box,
  Button,
  CircularProgress,
  styled,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { seq } from '@tunarr/shared/util';
import type { Channel } from '@tunarr/types';
import { type ChannelLineup, type TvGuideProgram } from '@tunarr/types';
import dayjs, { type Dayjs } from 'dayjs';
import { compact, isEmpty, isNull, isUndefined, round } from 'lodash-es';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { match, P } from 'ts-pattern';
import { useInterval } from 'usehooks-ts';
import { betterHumanize } from '../../helpers/dayjs.ts';
import { alternateColors, isNonEmptyString } from '../../helpers/util';
import { useRandomProgramBackgroundColor } from '../../hooks/colorHooks.ts';
import { useChannelsSuspense } from '../../hooks/useChannels.ts';
import { useServerEvents } from '../../hooks/useServerEvents.ts';
import { useTvGuides, useTvGuidesPrefetch } from '../../hooks/useTvGuide';
import type { Maybe, Nullable } from '../../types/util.ts';
import TunarrLogo from '../TunarrLogo';
import PaddedPaper from '../base/PaddedPaper';
import { ChannelOptionsMenu } from '../channels/ChannelOptionsMenu.tsx';
import ProgramDetailsDialog from '../programs/ProgramDetailsDialog.tsx';
import { TvGuideGridChild } from './TvGuideGridChild.tsx';
import { TvGuideItem } from './TvGuideItem.tsx';

const GridParent = styled(Box)({
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderWidth: '1px 0 0 1px',
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
  showStealth?: boolean;
};

export function TvGuide({ channelId, start, end, showStealth = true }: Props) {
  const theme = useTheme();
  // Workaround for issue with page jumping on-zoom or nav caused by collapsing
  // div when loading new guide data
  const ref = useRef<HTMLDivElement | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = !isNull(anchorEl);
  const [minHeight, setMinHeight] = useState(0);
  const smallViewport = useMediaQuery(theme.breakpoints.down('md'));

  const [channelMenu, setChannelMenu] = useState<Maybe<Channel>>();

  const [progress, setProgress] = useState(calcProgress(start, end));
  const [currentTime, setCurrentTime] = useState(dayjs().format('LT'));

  const [modalProgram, setModalProgram] = useState<
    TvGuideProgram | undefined
  >();

  const queryClient = useQueryClient();
  const { addListener, removeListener } = useServerEvents();

  const handleModalOpen = useCallback((program: TvGuideProgram | undefined) => {
    if (program?.type !== 'content') {
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
  const increments = +timelineDuration < +dayjs.duration(4, 'hour') ? 30 : 60;
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

  useTvGuidesPrefetch(channelId, {
    from: start.add(1, 'hour'),
    to: end.add(1, 'hour'),
  });

  const {
    isPending,
    error,
    data: channelLineup,
  } = useTvGuides(channelId, { from: start, to: end });

  const { data: channelsInfo } = useChannelsSuspense();

  useEffect(() => {
    if (ref.current) {
      setMinHeight(ref.current.offsetHeight);
    }
  }, [channelLineup]);

  const renderChannelMenu = () => {
    return channelMenu ? (
      <ChannelOptionsMenu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        row={channelMenu}
        hideItems={['duplicate', 'delete']}
      />
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
        .with({ type: 'content', subtype: 'episode' }, (p) => {
          const epTitle = p.title;
          if (isUndefined(p.parent?.index) || isUndefined(p.index)) {
            return epTitle;
          }
          const season = p.parent.index.toString().padStart(2, '0');
          const epIndex = p.index.toString().padStart(2, '0');
          return `S${season}E${epIndex} - ${epTitle}`;
        })
        .with({ type: 'content', subtype: 'movie' }, (p) =>
          compact([p.date ? dayjs(p.date).year() : null]).join(','),
        )
        .with({ type: 'content' }, (p) => p.title)
        .with(
          { type: 'custom', program: P.nonNullable },
          ({ program }) => program.title,
        )
        .with({ type: 'custom' }, () => '')
        .otherwise(() => '');

      const key = `${title}_${program.start}_${program.stop}`;
      const programStart = dayjs(program.start);
      const programEnd = dayjs(program.stop);
      let duration = program.stop - program.start;
      let endOfAvailableProgramming = false;

      // Trim any time that has already played from the currently playing program
      if (index === 0) {
        const trimStart = start.diff(programStart);
        duration -= trimStart;
      }

      // Calc for final program in lineup
      if (index === lineup.length - 1) {
        // If program goes beyond current guide duration, trim it so we get accurate program durations
        if (programEnd.isAfter(end)) {
          const trimEnd = programEnd.diff(end);
          duration -= trimEnd;
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
          let duration = currentProgram.stop - currentProgram.start;

          if (index === 0 && programStart.isBefore(start)) {
            const trimStart = start.diff(programStart);
            duration -= trimStart;
          }

          if (index === lineup.length - 1 && programEnd.isAfter(end)) {
            const trimEnd = programEnd.diff(end);
            duration -= trimEnd;
          }

          return totalDuration + duration;
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
      let remainingTime: Nullable<string> = null;

      if (isPlaying && !program.isPaused) {
        remainingTime = betterHumanize(dayjs.duration(programEnd.diff()));
        console.log(programStart, programEnd, remainingTime);
      } else if (program.isPaused && !isUndefined(program.timeRemaining)) {
        remainingTime = betterHumanize(dayjs.duration(program.timeRemaining));
      }

      const bg = randomBackgroundColor(program);

      return (
        <Fragment key={key}>
          <TvGuideItem
            // width={`${1200 * (+duration / +timelineDuration)}px`}
            width={`calc(100% * (${+duration / +timelineDuration}))`}
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
                    {remainingTime ? ` (${remainingTime} left)` : null}
                  </Box>
                </>
              ))}
          </TvGuideItem>
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
        <TvGuideItem
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
        </TvGuideItem>
      </Tooltip>
    );
  };

  const channels = seq.collect(channelLineup, (lineup, index) => {
    const channel = channelsInfo.find((c) => c.id === lineup.id);
    if (!channel) {
      return;
    }

    if (!showStealth && channel.stealth) {
      return;
    }

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
      const startUnix = +start;
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

  const programId =
    modalProgram?.type === 'custom'
      ? modalProgram.program?.uniqueId
      : modalProgram?.type === 'content'
        ? modalProgram?.id
        : null;

  const programType =
    modalProgram?.type === 'custom'
      ? modalProgram.program?.subtype
      : modalProgram?.type === 'content'
        ? modalProgram?.subtype
        : null;

  return (
    <PaddedPaper
      sx={{
        width: 'inherit',
        minHeight: minHeight >= 0 ? minHeight : undefined,
      }}
    >
      {modalProgram && programId && programType && (
        <ProgramDetailsDialog
          open={!isUndefined(modalProgram)}
          onClose={() => handleModalClose()}
          programId={programId}
          programType={programType}
          start={dayjs(modalProgram?.start)}
          stop={dayjs(modalProgram?.stop)}
        />
      )}
      <Box display="flex" ref={ref}>
        <Box
          display="flex"
          position="relative"
          flexDirection="column"
          sx={{ maxWidth: `${smallViewport ? '10%' : '15%'}` }}
        >
          <Box sx={{ height: '4rem' }}></Box>
          {channelsInfo
            .filter((c) => (showStealth ? true : !c.stealth))
            .map((channel) => (
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
              minWidth: '100%',
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
                <TvGuideGridChild
                  // width={`${1000 / (intervalArray.length > 4 ? intervalArray.length / 2 : intervalArray.length)}px`}
                  width={`calc(100% / ${intervalArray.length})`}
                  sx={{
                    height: '2rem',
                    borderLeft: '1px solid white',
                    // textAlign: 'center',
                    pl: 1,
                    '&:last-child': {
                      borderRight: '1px solid white',
                    },
                  }}
                  key={slot}
                >
                  {start
                    .add(slot * increments, 'minutes')
                    .format(`${smallViewport ? 'h:mm' : 'LT'}`)}
                </TvGuideGridChild>
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
              <>
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${progress}%`,
                    transition: 'left 0.5s linear',
                    zIndex: 11,
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
                </Box>
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
                      width: '2px',
                      background: theme.palette.primary.main,
                      height: '100%',
                      mt: '-2px',
                    }}
                  ></Box>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </PaddedPaper>
  );
}
