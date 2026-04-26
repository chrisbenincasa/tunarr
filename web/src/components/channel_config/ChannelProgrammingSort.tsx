import {
  Widgets as BlockShuffleIcon,
  Loop as CyclicIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  ImportExport as ManualIcon,
  CalendarMonth as ReleaseDateIcon,
  Shuffle as ShuffleIcon,
  SortByAlpha as SortByAlphaIcon,
  LiveTv as SortTVIcon,
} from '@mui/icons-material';
import { Button, ButtonGroup, MenuItem } from '@mui/material';
import { useState } from 'react';
import { useAlphaSort } from '../../hooks/programming_controls/useAlphaSort.ts';
import { useBlockShuffle } from '../../hooks/programming_controls/useBlockShuffle.ts';
import { useCyclicShuffle } from '../../hooks/programming_controls/useCyclicShuffle.ts';
import { useEpisodeNumberSort } from '../../hooks/programming_controls/useEpisodeNumberSort.ts';
import { useProgramShuffle } from '../../hooks/programming_controls/useRandomSort.ts';
import { useReleaseDateSort } from '../../hooks/programming_controls/useReleaseDateSort.ts';
import { useLingui } from '@lingui/react/macro';
import { ElevatedTooltip } from '../base/ElevatedTooltip.tsx';
import { StyledMenu } from '../base/StyledMenu.tsx';
import AddBlockShuffleModal from '../programming_controls/AddBlockShuffleModal.tsx';
import type { ShuffleGroupingValue } from '../programming_controls/ShuffleProgrammingModal.tsx';
import { ShuffleProgrammingModal } from '../programming_controls/ShuffleProgrammingModal.tsx';

type SortOption =
  | 'random'
  | 'cyclic'
  | 'alpha-asc'
  | 'alpha-desc'
  | 'episode-asc'
  | 'episode-desc'
  | 'release-asc'
  | 'release-desc'
  | 'block'
  | 'shows';

export function ChannelProgrammingSort() {
  const { t } = useLingui();
  const [sort, setSort] = useState<SortOption | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [addBlockShuffleModalOpen, setAddBlockShuffleModalOpen] =
    useState(false);
  const [shuffleProgrammingModalOpen, setShuffleProgrammingModalOpen] =
    useState(false);
  const open = Boolean(anchorEl);

  const [shuffleType, setShuffleType] = useState<ShuffleGroupingValue>('none');

  const shuffler = useProgramShuffle();
  const alphaSort = useAlphaSort();
  const releaseDateSort = useReleaseDateSort();
  const cyclicShuffle = useCyclicShuffle();
  const episodeSort = useEpisodeNumberSort();
  const { blockShuffle, canUsePerfectSync } = useBlockShuffle();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <ButtonGroup aria-label="Sort tools button group">
        {!sort && (
          <Button
            startIcon={<ManualIcon />}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={handleClick}
          >
            {t`Sort`}
          </Button>
        )}
        {sort === 'random' && (
          <Button
            startIcon={<ShuffleIcon />}
            onClick={() => shuffler(shuffleType)}
          >
            {shuffleType === 'show' ? t`Random (by show)` : t`Random`}
          </Button>
        )}
        {sort === 'cyclic' && (
          <Button startIcon={<CyclicIcon />} onClick={() => cyclicShuffle()}>
            {t`Cyclic Shuffle`}
          </Button>
        )}
        {(sort === 'alpha-asc' || sort === 'alpha-desc') && (
          <Button
            startIcon={<SortByAlphaIcon />}
            onClick={() => {
              alphaSort(sort === 'alpha-asc' ? 'desc' : 'asc');
              setSort(sort === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc');
            }}
          >
            {sort === 'alpha-asc' ? t`A-Z (asc)` : t`A-Z (desc)`}
          </Button>
        )}
        {(sort === 'release-asc' || sort === 'release-desc') && (
          <Button
            startIcon={<ReleaseDateIcon />}
            onClick={() => {
              releaseDateSort(sort === 'release-asc' ? 'desc' : 'asc');
              setSort(sort === 'release-asc' ? 'release-desc' : 'release-asc');
            }}
          >
            {sort === 'release-asc' ? t`Release Date (asc)` : t`Release Date (desc)`}
          </Button>
        )}
        {(sort === 'episode-asc' || sort === 'episode-desc') && (
          <Button
            startIcon={<SortTVIcon />}
            onClick={() => {
              episodeSort(sort === 'episode-asc' ? 'desc' : 'asc');
              setSort(sort === 'episode-asc' ? 'episode-desc' : 'episode-asc');
            }}
          >
            {sort === 'episode-asc' ? t`Sort TV Shows (asc)` : t`Sort TV Shows (desc)`}
          </Button>
        )}
        {sort === 'block' && (
          <Button
            startIcon={<BlockShuffleIcon />}
            onClick={() => setAddBlockShuffleModalOpen(true)}
          >
            {t`Block Shuffle`}
          </Button>
        )}
        {sort && (
          <Button onClick={handleClick}>
            <KeyboardArrowDownIcon />
          </Button>
        )}
      </ButtonGroup>

      <StyledMenu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem divider disabled>
          {t`Sort By...`}
        </MenuItem>
        <ElevatedTooltip
          elevation={5}
          title={t`Completely randomizes the order of programs.`}
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setSort('random');
              setShuffleProgrammingModalOpen(true);
              handleClose();
            }}
          >
            <ShuffleIcon /> {t`Random...`}
          </MenuItem>
        </ElevatedTooltip>

        <ElevatedTooltip
          elevation={5}
          title={t`Like Random Shuffle, but tries to preserve the sequence of episodes for each TV show. If a TV show has multiple instances of its episodes, they are also cycled appropriately.`}
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setSort('cyclic');
              cyclicShuffle();
              handleClose();
            }}
          >
            <CyclicIcon />
            {t`Cyclic Shuffle`}
          </MenuItem>
        </ElevatedTooltip>
        <ElevatedTooltip
          elevation={5}
          title={t`Alternates TV shows in blocks of episodes. You can pick the number of episodes per show in each block and if the order of shows in each block should be randomized. Movies are moved to the bottom.`}
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setAddBlockShuffleModalOpen(true);
              setSort('block');
              handleClose();
            }}
          >
            <BlockShuffleIcon />
            {t`Block Shuffle`}
          </MenuItem>
        </ElevatedTooltip>

        <ElevatedTooltip
          elevation={5}
          title={t`Sorts alphabetically by program title`}
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              alphaSort(sort === 'alpha-asc' ? 'desc' : 'asc');
              setSort(sort === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc');
              handleClose();
            }}
          >
            <SortByAlphaIcon />
            {t`Alphabetically`}
          </MenuItem>
        </ElevatedTooltip>

        <ElevatedTooltip
          elevation={5}
          title={t`Sorts everything by its release date. This will only work correctly if the release dates in Plex are correct. In case any item does not have a release date specified, it will be moved to the bottom.`}
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              releaseDateSort(sort === 'release-asc' ? 'desc' : 'asc');
              setSort(sort === 'release-asc' ? 'release-desc' : 'release-asc');
              handleClose();
            }}
          >
            <ReleaseDateIcon />
            {t`Release Date`}
          </MenuItem>
        </ElevatedTooltip>
        <ElevatedTooltip
          elevation={5}
          title={t`Sorts the list by TV Show and the episodes in each TV show by their season/episode number. Movies are moved to the bottom of the schedule.`}
          placement="right"
        >
          <MenuItem
            disableRipple
            onClick={() => {
              episodeSort(sort === 'episode-asc' ? 'desc' : 'asc');
              setSort(sort === 'episode-asc' ? 'episode-desc' : 'episode-asc');
              handleClose();
            }}
          >
            <SortTVIcon />
            {t`Sort TV Shows`}
          </MenuItem>
        </ElevatedTooltip>
      </StyledMenu>
      <AddBlockShuffleModal
        open={addBlockShuffleModalOpen}
        onClose={() => setAddBlockShuffleModalOpen(false)}
        blockShuffle={blockShuffle}
        canUsePerfectSync={canUsePerfectSync}
      />
      <ShuffleProgrammingModal
        open={shuffleProgrammingModalOpen}
        onClose={() => setShuffleProgrammingModalOpen(false)}
        shuffleType={shuffleType}
        onShuffleTypeChange={setShuffleType}
      />
    </>
  );
}
