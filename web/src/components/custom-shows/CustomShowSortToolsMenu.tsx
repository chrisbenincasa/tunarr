import {
  CalendarMonth,
  Construction,
  Delete,
  KeyboardArrowDown,
  Shuffle,
  Widgets,
} from '@mui/icons-material';
import {
  Button,
  ButtonGroup,
  ListItemIcon,
  ListItemText,
  MenuItem,
} from '@mui/material';
import React, { useState } from 'react';
import { useCustomShowBlockShuffle } from '../../hooks/programming_controls/useBlockShuffle.ts';
import { useProgramShuffle } from '../../hooks/programming_controls/useRandomSort.ts';
import { useCustomShowReleaseDateSort } from '../../hooks/programming_controls/useReleaseDateSort.ts';
import { setCurrentCustomShowProgramming } from '../../store/customShowEditor/actions.ts';
import { useCustomShowEditor } from '../../store/selectors.ts';
import { strings } from '../../strings.ts';
import { ElevatedTooltip } from '../base/ElevatedTooltip.tsx';
import { StyledMenu } from '../base/StyledMenu.tsx';
import AddBlockShuffleModal from '../programming_controls/AddBlockShuffleModal.tsx';
import {
  ShuffleProgrammingModal,
  type ShuffleGroupingValue,
} from '../programming_controls/ShuffleProgrammingModal.tsx';

type OrdereredSort<T extends string> = `${T}-asc` | `${T}-desc`;
type PossibleSorts = 'random' | OrdereredSort<'release'> | 'block';

export const CustomShowSortToolsMenu = () => {
  const { programList } = useCustomShowEditor();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = !!anchorEl;
  const [selectedSort, setSelectedSort] = useState<PossibleSorts | null>(null);
  const [addBlockShuffleModalOpen, setAddBlockShuffleModalOpen] =
    useState(false);
  const [shuffleProgrammingModalOpen, setShuffleProgrammingModalOpen] =
    useState(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };
  const [shuffleType, setShuffleType] = useState<ShuffleGroupingValue>('none');
  const { blockShuffle, canUsePerfectSync } = useCustomShowBlockShuffle();
  const releaseDateSort = useCustomShowReleaseDateSort();
  const shuffler = useProgramShuffle();

  const renderCurrentSortButton = () => {
    if (!selectedSort) {
      return (
        <Button
          startIcon={<Construction />}
          endIcon={<KeyboardArrowDown />}
          onClick={handleClick}
        >
          Tools
        </Button>
      );
    }

    const button: React.ReactElement[] = [
      <Button onClick={handleClick}>
        <KeyboardArrowDown />
      </Button>,
    ];

    switch (selectedSort) {
      case 'random':
        button.unshift(
          <Button startIcon={<Shuffle />} onClick={() => shuffler(shuffleType)}>
            Random{shuffleType === 'show' ? ' (by show)' : ''}
          </Button>,
        );
        break;
      case 'release-asc':
      case 'release-desc':
        button.unshift(
          <Button
            startIcon={<CalendarMonth />}
            onClick={() => {
              releaseDateSort(selectedSort === 'release-asc' ? 'desc' : 'asc');
              setSelectedSort(
                selectedSort === 'release-asc' ? 'release-desc' : 'release-asc',
              );
            }}
          >
            Release Date {selectedSort === 'release-asc' ? '(asc)' : '(desc)'}
          </Button>,
        );
        break;
      case 'block':
        button.unshift(
          <Button
            startIcon={<Widgets />}
            onClick={() => setAddBlockShuffleModalOpen(true)}
          >
            Block Shuffle
          </Button>,
        );
        break;
    }

    return button;
  };

  return (
    <>
      <ButtonGroup
        variant="outlined"
        aria-label="Basic button group"
        disabled={programList.length === 0}
      >
        {renderCurrentSortButton()}
      </ButtonGroup>
      <StyledMenu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem divider disabled>
          Sort By...
        </MenuItem>
        <ElevatedTooltip
          title={strings.SHUFFLE_TOOLTIP}
          placement="right"
          elevation={10}
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setSelectedSort('random');
              setShuffleProgrammingModalOpen(true);
              handleClose();
            }}
          >
            <ListItemIcon>
              <Shuffle />
            </ListItemIcon>
            <ListItemText>Random&hellip;</ListItemText>
          </MenuItem>
        </ElevatedTooltip>
        <ElevatedTooltip
          title={strings.RELEASE_SORT_TOOLTIP}
          placement="right"
          elevation={10}
        >
          <MenuItem
            disableRipple
            onClick={() => {
              releaseDateSort(selectedSort === 'release-asc' ? 'desc' : 'asc');
              setSelectedSort('release-asc');
              handleClose();
            }}
          >
            <ListItemIcon>
              <CalendarMonth />
            </ListItemIcon>
            <ListItemText>Release Date</ListItemText>
          </MenuItem>
        </ElevatedTooltip>
        <ElevatedTooltip
          title={strings.BLOCK_SHUFFLE_TOOLTIP}
          placement="right"
          elevation={10}
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setAddBlockShuffleModalOpen(true);
              setSelectedSort('block');
              handleClose();
            }}
          >
            <ListItemIcon>
              <Widgets />
            </ListItemIcon>
            <ListItemText>Block Shuffle</ListItemText>
          </MenuItem>
        </ElevatedTooltip>
        <MenuItem divider disabled>
          Delete
        </MenuItem>
        <ElevatedTooltip
          title="Removes all programs from custom show"
          placement="right"
          elevation={10}
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setCurrentCustomShowProgramming([]);
              handleClose();
            }}
          >
            <Delete />
            Clear All
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
};
