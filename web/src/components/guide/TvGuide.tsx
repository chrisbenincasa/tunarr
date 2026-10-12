import { Trans, useLingui } from '@lingui/react/macro';
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
import { invalidateTaggedQueries } from '@/helpers/queryUtil.ts';
import { seq } from '@tunarr/shared/util';
import type { Channel } from '@tunarr/types';
import { type ChannelLineup, type TvGuideProgram } from '@tunarr/types';
import dayjs, { type Dayjs } from 'dayjs';
import { compact, isNull, isUndefined, round } from 'lodash-es';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { match, P } from 'ts-pattern';
import { useInterval, useResizeObserver } from 'usehooks-ts';
import { betterHumanize } from '../../helpers/dayjs.ts';
import { extractProgramGrandparent } from '../../helpers/programUtil.ts';
import { alternateColors, isNonEmptyString } from '../../helpers/util';
import { useRandomProgramBackgroundColor } from '../../hooks/colorHooks.ts';
import { useChannelsSuspense } from '../../hooks/useChannels.ts';
import { useServerEvents } from '../../hooks/useServerEvents.ts';
import { useTvGuides, useTvGuidesPrefetch } from '../../hooks/useTvGuide';
import type { Maybe, Nullable } from '../../types/util.ts';
import PaddedPaper from '../base/PaddedPaper';
import { ChannelIconDisplay } from '../channels/ChannelIconDisplay.tsx';
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

// Below these pixel widths, blocks drop their text and header times shorten
// or thin out, because the full text would only show as clipped fragments.
const CompactBlockPx = 24;
const ShortTimeSlotPx = 80;
const SparseTimeSlotPx = 48;

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
  const { t } = useLingui();
  const theme = useTheme();
  // Workaround for issue with page jumping on-zoom or nav caused by collapsing
  // div when loading new guide data
  const ref = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { width: gridWidth = 0 } = useResizeObserver({ ref: gridRef });
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
            // The guide renders from the channel lineup endpoints, which carry
            // the 'Channels' tag -- not the 'Guide' tag, which belongs to the
            // separate /api/guide/channels endpoints this page never calls.
            predicate: invalidateTaggedQueries('Channels'),
          })
          .catch(console.error);
      }
    });
    return () => removeListener(key);
  }, [addListener, queryClient, removeListener]);

  const timelineDuration = dayjs.duration(end.diff(start));
  const toPercent = (ms: number) => (ms / +timelineDuration) * 100;
  const increments = +timelineDuration < +dayjs.duration(4, 'hour') ? 30 : 60;
  const intervalArray = Array.from(
    Array(timelineDuration.asMinutes() / increments).keys(),
  );

  const slotPx = gridWidth / intervalArray.length;
  const shortTimeLabels =
    smallViewport || (gridWidth > 0 && slotPx < ShortTimeSlotPx);
  const sparseTimeLabels = gridWidth > 0 && slotPx < SparseTimeSlotPx;

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
          { type: 'content' },
          ({ program }) => !!extractProgramGrandparent(program),
          ({ program }) => extractProgramGrandparent(program)!.title,
        )
        .with({ type: 'content' }, ({ program }) => program.title)
        .with(
          {
            type: 'custom',
            program: { program: P.select({ title: P.nonNullable }) },
          },
          ({ title }) => title,
        )
        .with({ type: 'custom' }, () => t`Custom Program`)
        .with({ type: 'redirect' }, (p) => t`Redirect to Channel ${p.channel}`)
        .with({ type: 'flex' }, (p) => p.title ?? flexTitle)
        .exhaustive();

      const episodeTitle = match(program)
        .with(
          { type: 'custom', program: { program: { type: 'movie' } } },
          ({ program: { program: p } }) =>
            compact([p.releaseDate ? dayjs(p.releaseDate).year() : null]).join(
              ',',
            ),
        )
        .with(
          { type: 'content', program: { type: 'episode' } },
          ({ program: p }) => {
            const epTitle = p.title;
            if (isUndefined(p.season?.index) || isUndefined(p.episodeNumber)) {
              return epTitle;
            }
            const season = p.season.index.toString().padStart(2, '0');
            const epIndex = p.episodeNumber.toString().padStart(2, '0');
            return `S${season}E${epIndex} - ${epTitle}`;
          },
        )
        .with(
          { type: 'content', program: { type: 'movie' } },
          ({ program: p }) =>
            compact([p.releaseDate ? dayjs(p.releaseDate).year() : null]).join(
              ',',
            ),
        )
        .with({ type: 'content' }, ({ program: p }) => p.title)
        .with(
          { type: 'custom', program: { program: P.select(P.nonNullable) } },
          (program) => program.title,
        )
        .with({ type: 'custom' }, () => '')
        .otherwise(() => '');

      const key = `${title}_${program.start}_${program.stop}`;
      const programStart = dayjs(program.start);
      const programEnd = dayjs(program.stop);
      const left = toPercent(Math.max(program.start, +start) - +start);
      const pct = toPercent(
        Math.min(program.stop, +end) - Math.max(program.start, +start),
      );

      if (pct <= 0) {
        return null;
      }

      const isCompact =
        gridWidth > 0 && (pct / 100) * gridWidth < CompactBlockPx;

      const endOfAvailableProgramming =
        index === lineup.length - 1 && programEnd.isBefore(end);

      const isPlaying = dayjs().isBetween(programStart, programEnd);
      let remainingTime: Nullable<string> = null;

      if (isPlaying && !program.isPaused) {
        remainingTime = betterHumanize(dayjs.duration(programEnd.diff()));
      } else if (program.isPaused && !isUndefined(program.timeRemaining)) {
        remainingTime = betterHumanize(dayjs.duration(program.timeRemaining));
      }

      const bg = randomBackgroundColor(program);

      return (
        <Fragment key={key}>
          <TvGuideItem
            left={left}
            width={pct}
            compact={isCompact}
            title={isCompact ? title : undefined}
            index={index}
            onClick={() => handleModalOpen(program)}
            backgroundColor={bg}
            program={program}
          >
            {isCompact ? null : (
              <>
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
                        {remainingTime ? (
                          <Trans>{remainingTime} left</Trans>
                        ) : null}
                      </Box>
                    </>
                  ))}
              </>
            )}
          </TvGuideItem>
          {endOfAvailableProgramming
            ? renderUnavailableProgramming(
                toPercent(program.stop - +start),
                toPercent(+end - program.stop),
                index,
              )
            : null}
        </Fragment>
      );
    };
  };

  const renderUnavailableProgramming = (
    left: number,
    width: number,
    index: number,
  ) => {
    const bg = alternateColors(index, theme.palette.mode);
    return (
      <Tooltip
        title={t`No programming scheduled for this time period`}
        placement="top"
      >
        <TvGuideItem
          left={left}
          width={width}
          index={index}
          sx={{
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
            <Trans>No Programming scheduled</Trans>
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

    let alignedLineup = lineup.programs;
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
      alignedLineup = [
        {
          type: 'flex',
          duration: fillerLength,
          start: startUnix,
          stop: lineup.programs[0].start,
          title: flexPlaceholderTitle,
          isPaused: false,
        },
        ...lineup.programs,
      ];
    }
    return (
      <Box
        key={lineup.id}
        component="section"
        sx={{
          position: 'relative',
          height: '4rem',
          flexShrink: 0,
        }}
      >
        {alignedLineup.length > 0
          ? alignedLineup.map(renderProgram(lineup))
          : renderUnavailableProgramming(0, 100, index)}
      </Box>
    );
  });

  const programId =
    modalProgram?.type === 'custom'
      ? modalProgram.program?.id
      : modalProgram?.type === 'content'
        ? modalProgram?.id
        : null;

  const programType =
    modalProgram?.type === 'custom'
      ? modalProgram.program?.program.type
      : modalProgram?.type === 'content'
        ? modalProgram?.program.type
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
                    <ChannelIconDisplay
                      icon={channel.icon}
                      style={{ width: '40px' }}
                    />
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
        <Box sx={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
          {/* Children size as percentages of this column, so its width must
              never depend on their content. */}
          <Box
            ref={gridRef}
            sx={{
              display: 'flex',
              position: 'relative',
              flexDirection: 'column',
              width: '100%',
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
                <TvGuideGridChild
                  width={`calc(100% / ${intervalArray.length})`}
                  sx={{
                    height: '2rem',
                    minWidth: 0,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    borderLeft: '1px solid white',
                    // textAlign: 'center',
                    pl: 1,
                    '&:last-child': {
                      borderRight: '1px solid white',
                    },
                  }}
                  key={slot}
                >
                  {sparseTimeLabels && slot % 2 === 1
                    ? null
                    : start
                        .add(slot * increments, 'minutes')
                        .format(shortTimeLabels ? 'h:mm' : 'LT')}
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
                  <Trans>An error occurred: {error.message}</Trans>
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
                {/* Shifting the pill left by its own progress fraction keeps it
                    inside the grid at both edges. */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${progress}%`,
                    transform: `translateX(-${progress}%)`,
                    transition: 'left 0.5s linear, transform 0.5s linear',
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
