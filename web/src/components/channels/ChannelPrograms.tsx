import type { TabProps } from '@mui/material';
import { Tab, Tabs, Typography } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type { ContentProgram, ContentProgramParent } from '@tunarr/types';
import {
  ContentProgramTypeSchema,
  type ContentProgramType,
} from '@tunarr/types/schemas';
import { groupBy, isNil, keys, mapValues, omitBy } from 'lodash-es';
import { useMemo, useState } from 'react';
import { useChannelAndProgramming } from '../../hooks/useChannelLineup.ts';
import { TabPanel } from '../TabPanel.tsx';
import { ChannelProgramGrid } from './ChannelProgramGrid.tsx';

type Props = {
  channelId: string;
};

type ProgramTabProps = TabProps & {
  selected: boolean;
  programCount: number;
  programType: ContentProgramType;
};

const ProgramTypeToLabel: Record<ContentProgramType, string> = {
  episode: 'Shows',
  movie: 'Movies',
  music_video: 'Music Videos',
  other_video: 'Other Videos',
  track: 'Artists',
};

const ProgramTypeToGridType: Record<
  ContentProgramType,
  ContentProgramType | ContentProgramParent['type']
> = {
  episode: 'show',
  movie: 'movie',
  music_video: 'music_video',
  other_video: 'other_video',
  track: 'artist',
};

const ProgramTypeTab = ({
  programCount,
  programType,
  selected,
  ...rest
}: ProgramTabProps) => {
  return (
    <Tab
      {...rest}
      label={
        <>
          <Typography
            component="span"
            sx={{ verticalAlign: 'middle', fontSize: '0.875rem' }}
          >
            {ProgramTypeToLabel[programType]}
            <Typography
              component="span"
              sx={{
                display: 'inline-block',
                ml: 1,
                height: 21,
                minWidth: 21,
                backgroundColor: (theme) =>
                  selected
                    ? theme.palette.primary.main
                    : theme.palette.mode === 'dark'
                      ? theme.palette.grey[800]
                      : theme.palette.grey[400],
                color: (theme) =>
                  selected
                    ? theme.palette.getContrastText(theme.palette.primary.main)
                    : 'inherit',
                borderRadius: 10,
                px: 0.8,
                fontSize: 'inherit',
              }}
            >
              {programCount}
            </Typography>
          </Typography>
        </>
      }
      disabled={programCount === 0}
    />
  );
};

export const ChannelPrograms = ({ channelId }: Props) => {
  const {
    data: {
      lineup: { lineup, programs },
    },
  } = useChannelAndProgramming(channelId);

  const programsByType = useMemo(
    () =>
      groupBy(
        seq.collect(lineup, (p) => {
          if (p.type === 'content' && p.id) {
            return programs[p.id];
          } else if (p.type === 'custom') {
            return programs[p.id];
          }
          return;
        }),
        (p) => p.subtype,
      ),
    [lineup, programs],
  ) as Record<ContentProgramType, ContentProgram[]>;

  // TODO: Do this in the database
  const [epsByShow] = useMemo(() => {
    const epsByProgram = mapValues(
      omitBy(
        groupBy(programsByType['episode'], (ep) => ep.grandparent?.id),
        isNil,
      ),
      (p) => p.length,
    );
    const epsBySeason = mapValues(
      omitBy(
        groupBy(programsByType['episode'], (ep) => ep.parent?.id),
        isNil,
      ),
      (p) => p.length,
    );
    return [epsByProgram, epsBySeason];
  }, [programsByType]);

  const [tracksByArtist] = useMemo(() => {
    const epsByProgram = mapValues(
      omitBy(
        groupBy(programsByType['track'], (ep) => ep.grandparent?.id),
        isNil,
      ),
      (p) => p.length,
    );
    const epsBySeason = mapValues(
      omitBy(
        groupBy(programsByType['track'], (ep) => ep.parent?.id),
        isNil,
      ),
      (p) => p.length,
    );
    return [epsByProgram, epsBySeason];
  }, [programsByType]);

  const [tab, setTab] = useState(() => {
    for (const [key, programs] of Object.entries(programsByType)) {
      if (programs.length > 0) {
        switch (key as ContentProgramType) {
          case 'movie':
            return 0;
          case 'episode':
            return 1;
          case 'track':
            return 2;
          case 'music_video':
            return 3;
          case 'other_video':
            return 4;
        }
      }
    }

    return 0;
  });

  return (
    <>
      <Tabs value={tab} onChange={(_, v) => setTab(v as number)}>
        {Object.values(ContentProgramTypeSchema.enum).map((v, idx) => (
          <ProgramTypeTab
            key={v}
            value={idx}
            programCount={
              v === 'episode'
                ? keys(epsByShow).length
                : v === 'track'
                  ? keys(tracksByArtist).length
                  : (programsByType[v]?.length ?? 0)
            }
            programType={v}
            selected={tab === idx}
          />
        ))}
      </Tabs>
      {Object.values(ContentProgramTypeSchema.enum).map((v, idx) => (
        <TabPanel index={idx} value={tab} key={v}>
          <ChannelProgramGrid
            channelId={channelId}
            programType={ProgramTypeToGridType[v]}
          />
        </TabPanel>
      ))}
    </>
  );
};
