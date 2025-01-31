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
import { Button, ButtonGroup, MenuItem, Tooltip } from '@mui/material';
import { useState } from 'react';
import { useAlphaSort } from '../../hooks/programming_controls/useAlphaSort.ts';
import { useBlockShuffle } from '../../hooks/programming_controls/useBlockShuffle.ts';
import { useCyclicShuffle } from '../../hooks/programming_controls/useCyclicShuffle.ts';
import { useEpisodeNumberSort } from '../../hooks/programming_controls/useEpisodeNumberSort.ts';
import { useRandomSort } from '../../hooks/programming_controls/useRandomSort.ts';
import { useReleaseDateSort } from '../../hooks/programming_controls/useReleaseDateSort.ts';
import { strings } from '../../strings.ts';
import { StyledMenu } from '../base/StyledMenu.tsx';
import AddBlockShuffleModal from '../programming_controls/AddBlockShuffleModal.tsx';

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
  const [sort, setSort] = useState<SortOption | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [addBlockShuffleModalOpen, setAddBlockShuffleModalOpen] =
    useState(false);
  const open = Boolean(anchorEl);

  const randomSort = useRandomSort();
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
      <ButtonGroup variant="contained" aria-label="Basic button group">
        {!sort && (
          <Button
            startIcon={<ManualIcon />}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={handleClick}
          >
            Sort
          </Button>
        )}
        {sort === 'random' && (
          <Button startIcon={<ShuffleIcon />} onClick={() => randomSort()}>
            Random
          </Button>
        )}
        {sort === 'cyclic' && (
          <Button startIcon={<CyclicIcon />} onClick={() => cyclicShuffle()}>
            Cyclic Shuffle
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
            A-Z {sort === 'alpha-asc' ? '(asc)' : '(desc)'}
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
            Release Date {sort === 'release-asc' ? '(asc)' : '(desc)'}
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
            Sort TV Shows {sort === 'episode-asc' ? '(asc)' : '(desc)'}
          </Button>
        )}
        {sort === 'block' && (
          <Button
            startIcon={<BlockShuffleIcon />}
            onClick={() => setAddBlockShuffleModalOpen(true)}
          >
            Block Shuffle
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
          Sort By...
        </MenuItem>
        <Tooltip title={strings.SHUFFLE_TOOLTIP} placement="right">
          <MenuItem
            disableRipple
            onClick={() => {
              randomSort();
              setSort('random');
              handleClose();
            }}
          >
            <ShuffleIcon /> Random
          </MenuItem>
        </Tooltip>

        <Tooltip title={strings.CYCLIC_SHUFFLE_TOOLTIP} placement="right">
          <MenuItem
            disableRipple
            onClick={() => {
              setSort('cyclic');
              cyclicShuffle();
              handleClose();
            }}
          >
            <CyclicIcon />
            Cyclic Shuffle
          </MenuItem>
        </Tooltip>

        <Tooltip title={strings.ALPHA_SORT_TOOLTIP} placement="right">
          <MenuItem
            disableRipple
            onClick={() => {
              alphaSort(sort === 'alpha-asc' ? 'desc' : 'asc');
              setSort(sort === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc');
              handleClose();
            }}
          >
            <SortByAlphaIcon />
            Alphabetically
          </MenuItem>
        </Tooltip>

        <Tooltip title={strings.RELEASE_SORT_TOOLTIP} placement="right">
          <MenuItem
            disableRipple
            onClick={() => {
              releaseDateSort(sort === 'release-asc' ? 'desc' : 'asc');
              setSort(sort === 'release-asc' ? 'release-desc' : 'release-asc');
              handleClose();
            }}
          >
            <ReleaseDateIcon />
            Release Date
          </MenuItem>
        </Tooltip>
        <Tooltip title={strings.EPISODE_SORT_TOOLTIP} placement="right">
          <MenuItem
            disableRipple
            onClick={() => {
              episodeSort(sort === 'episode-asc' ? 'desc' : 'asc');
              setSort(sort === 'episode-asc' ? 'episode-desc' : 'episode-asc');
              handleClose();
            }}
          >
            <SortTVIcon />
            Sort TV Shows
          </MenuItem>
        </Tooltip>
        <Tooltip title={strings.BLOCK_SHUFFLE_TOOLTIP} placement="right">
          <MenuItem
            disableRipple
            onClick={() => {
              setAddBlockShuffleModalOpen(true);
              setSort('block');
              handleClose();
            }}
          >
            <BlockShuffleIcon />
            Block Shuffle
          </MenuItem>
        </Tooltip>
      </StyledMenu>
      <AddBlockShuffleModal
        open={addBlockShuffleModalOpen}
        onClose={() => setAddBlockShuffleModalOpen(false)}
        blockShuffle={blockShuffle}
        canUsePerfectSync={canUsePerfectSync}
      />
    </>
  );
}
