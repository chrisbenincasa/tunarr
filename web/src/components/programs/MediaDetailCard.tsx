import { getProgramSummary } from '@/helpers/programUtil';
import { useSettings } from '@/store/settings/selectors';
import { MoreVert, OpenInNew } from '@mui/icons-material';
import {
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link } from '@tanstack/react-router';
import {
  isChildItem,
  type ProgramGrouping,
  type TerminalProgram,
} from '@tunarr/types';
import { capitalize } from 'lodash-es';
import { useMemo, useState } from 'react';
import { useGetArtworkUrl } from '../../hooks/useThumbnailUrl.ts';
import type { Nullable } from '../../types/util.ts';
import ProgramInfoBar from './ProgramInfoBar';
import { ProgramOperationsMenu } from './ProgramOperationsMenu.tsx';

type Props = {
  program: TerminalProgram | ProgramGrouping;
};

export default function MediaDetailCard({ program }: Props) {
  const theme = useTheme();
  const settings = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);
  const [posterError, setPosterError] = useState(false);

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const externalLink = useMemo(() => {
    return `${settings.backendUri}/api/programs/${program.uuid}/external-link`;
  }, [settings.backendUri, program]);

  const [moreMenuAnchorEl, setMoreMenuAnchorEl] =
    useState<Nullable<HTMLElement>>(null);

  const getProgramDescription = useMemo(() => {
    return getProgramSummary(program);
  }, [program]);

  const description = getProgramDescription;
  const maxLength = 1000;
  const isLongDescription = description && description.length > maxLength;

  const displayText = useMemo(() => {
    if (!description) {
      return null;
    }

    if (isLongDescription && !isExpanded) {
      return description.substring(0, maxLength) + '...';
    }

    return description;
  }, [description, isLongDescription, isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  const getArtworkUrl = useGetArtworkUrl();

  const programTitle = useMemo(() => {
    let title, type, uuid;
    switch (program.type) {
      case 'season':
        title = program?.show?.title;
        type = program?.show?.type;
        uuid = program?.show?.uuid;
        break;
      case 'episode':
        title = program?.show?.title;
        type = program?.show?.type;
        uuid = program?.show?.uuid;
        break;
      case 'album':
        title = program?.artist?.title;
        type = program?.artist?.type;
        uuid = program?.artist?.uuid;
        break;
      case 'track':
        title = program?.artist?.title;
        type = program?.artist?.type;
        uuid = program?.artist?.uuid;
        break;
      default:
        title = program.title;
        break;
    }

    return isChildItem(program.type) && type && uuid ? (
      <>
        <Link
          to={`/media/$programType/$programId`}
          params={{
            programType: type,
            programId: uuid,
          }}
          resetScroll={true}
          color="inherit"
          style={{ textDecoration: 'none' }}
        >
          <Typography variant="h3" component="h1" color="text.primary">
            {title}
          </Typography>
        </Link>
        {program.type === 'episode' && (
          <Typography
            variant="h5"
            component="h5"
            color="text.secondary"
            fontStyle={'italic'}
          >
            {program.title}
          </Typography>
        )}
      </>
    ) : (
      <Typography variant="h3" component="h1" color="text.primary">
        {title}
      </Typography>
    );
  }, [program]);

  return (
    // <Grid container spacing={isMobile ? 3 : 5}>
    <Box>
      <Stack direction={'column'}></Stack>
      <Stack
        direction="row"
        spacing={smallViewport ? 0 : 2}
        flexDirection={isMobile ? 'column' : 'row'}
        flexWrap={'nowrap'}
      >
        <Box
          sx={{
            position: 'relative',
            minWidth: '25%',
            maxWidth: isMobile ? 'none' : 400,
          }}
        >
          <Box>
            {posterError ? (
              <Box
                sx={{
                  width: '100%',
                  height: 255,
                  boxShadow: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  backgroundColor: 'grey.700',
                }}
              ></Box>
            ) : (
              <Box
                component="img"
                src={getArtworkUrl(program) ?? undefined}
                alt={`${program.title} Poster`}
                onError={() => setPosterError(true)}
                width={'100%'}
                sx={{
                  borderRadius: '10px',
                }}
              />
            )}
          </Box>

          {program.sourceType !== 'local' && externalLink && (
            <Button
              variant="outlined"
              component="a"
              target="_blank"
              href={externalLink}
              endIcon={<OpenInNew />}
              sx={{
                '&:hover': {
                  opacity: 0.9,
                },
                width: '100%',
                marginY: 1,
              }}
            >
              {`Open in ${capitalize(program.sourceType)}`}
            </Button>
          )}
        </Box>
        <Box maxWidth={700}>
          <Stack spacing={1}>
            <Stack direction={'row'} sx={{ alignItems: 'center' }}>
              <Box flex={1}>{programTitle}</Box>
              <IconButton
                sx={{ width: 40, height: 40 }}
                onClick={(e) => setMoreMenuAnchorEl(e.currentTarget)}
              >
                <MoreVert />
              </IconButton>
            </Stack>
            <ProgramOperationsMenu
              programId={program.uuid}
              programType={program.type}
              anchorEl={moreMenuAnchorEl}
              onClose={() => setMoreMenuAnchorEl(null)}
              open={!!moreMenuAnchorEl}
            />

            <Stack
              direction="row"
              alignItems="center"
              sx={{
                borderTop: `1px solid`,
                borderBottom: `1px solid`,
                paddingY: 1,
                flexWrap: 'wrap',
              }}
            >
              <ProgramInfoBar program={program} />
            </Stack>
            <Typography>{displayText}</Typography>
            {isLongDescription && (
              <Button variant="contained" onClick={toggleExpanded}>
                {isExpanded ? 'Read Less' : 'Read More'}
              </Button>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
