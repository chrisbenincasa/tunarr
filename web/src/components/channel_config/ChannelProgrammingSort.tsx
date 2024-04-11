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
import Menu, { MenuProps } from '@mui/material/Menu';
import { alpha, styled } from '@mui/material/styles';
import { useState } from 'react';
import { useAlphaSort } from '../../hooks/programming_controls/useAlphaSort.ts';
import { useCyclicShuffle } from '../../hooks/programming_controls/useCyclicShuffle.ts';
import { useRandomSort } from '../../hooks/programming_controls/useRandomSort.ts';
import { useReleaseDateSort } from '../../hooks/programming_controls/useReleaseDateSort.ts';

import { useEpisodeNumberSort } from '../../hooks/programming_controls/useEpisodeNumberSort.ts';
import AddBlockShuffleModal from '../programming_controls/AddBlockShuffleModal.tsx';

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
    color:
      theme.palette.mode === 'light'
        ? 'rgb(55, 65, 81)'
        : theme.palette.grey[300],
    boxShadow:
      'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    '& .MuiMenu-list': {
      padding: '4px 0',
    },
    '& .MuiMenuItem-root': {
      '& .MuiSvgIcon-root': {
        fontSize: 18,
        color: theme.palette.text.secondary,
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
            Alphabetically {sort === 'alpha-asc' ? '(asc)' : '(desc)'}
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

      <StyledMenu
        id="demo-customized-menu"
        MenuListProps={{
          'aria-labelledby': 'demo-customized-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem divider disabled>
          Sort By...
        </MenuItem>
        <Tooltip
          title="Completely randomizes the order of programs."
          placement="right"
        >
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

        <Tooltip
          title="Like Random Shuffle, but tries to preserve the sequence of episodes for each TV show. If a TV show has multiple instances of its episodes, they are also cycled appropriately."
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
            Cyclic Shuffle
          </MenuItem>
        </Tooltip>

        <Tooltip
          title="Sorts alphabetically by program title"
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
            Alphabetically
          </MenuItem>
        </Tooltip>

        <Tooltip
          title="Sorts everything by its release date. This will only work correctly if the release dates in Plex are correct. In case any item does not have a release date specified, it will be moved to the bottom."
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
            Release Date
          </MenuItem>
        </Tooltip>
        <Tooltip
          title="Sorts the list by TV Show and the episodes in each TV show by their season/episode number. Movies are moved to the bottom of the schedule."
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
            Sort TV Shows
          </MenuItem>
        </Tooltip>
        <Tooltip
          title="Alternates TV shows in blocks of episodes. You can pick the number of episodes per show in each block and if the order of shows in each block should be randomized. Movies are moved to the bottom."
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
            Block Shuffle
          </MenuItem>
        </Tooltip>
      </StyledMenu>
      <AddBlockShuffleModal
        open={addBlockShuffleModalOpen}
        onClose={() => setAddBlockShuffleModalOpen(false)}
      />
    </>
  );
}
