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
import { Trans, useLingui } from '@lingui/react/macro';
import { setCurrentCustomShowProgramming } from '../../store/customShowEditor/actions.ts';
import { useCustomShowEditor } from '../../store/selectors.ts';
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
  const { t } = useLingui();
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
          <Trans>Tools</Trans>
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
            {shuffleType === 'show' ? <Trans>Random (by show)</Trans> : <Trans>Random</Trans>}
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
            {selectedSort === 'release-asc' ? <Trans>Release Date (asc)</Trans> : <Trans>Release Date (desc)</Trans>}
          </Button>,
        );
        break;
      case 'block':
        button.unshift(
          <Button
            startIcon={<Widgets />}
            onClick={() => setAddBlockShuffleModalOpen(true)}
          >
            <Trans>Block Shuffle</Trans>
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
        aria-label={t`Basic button group`}
        disabled={programList.length === 0}
      >
        {renderCurrentSortButton()}
      </ButtonGroup>
      <StyledMenu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem divider disabled>
          <Trans>Sort By...</Trans>
        </MenuItem>
        <ElevatedTooltip
          title={t`Completely randomizes the order of programs.`}
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
            <ListItemText><Trans>Random&hellip;</Trans></ListItemText>
          </MenuItem>
        </ElevatedTooltip>
        <ElevatedTooltip
          title={t`Sorts everything by its release date. This will only work correctly if the release dates in Plex are correct. In case any item does not have a release date specified, it will be moved to the bottom.`}
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
            <ListItemText><Trans>Release Date</Trans></ListItemText>
          </MenuItem>
        </ElevatedTooltip>
        <ElevatedTooltip
          title={t`Alternates TV shows in blocks of episodes. You can pick the number of episodes per show in each block and if the order of shows in each block should be randomized. Movies are moved to the bottom.`}
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
            <ListItemText><Trans>Block Shuffle</Trans></ListItemText>
          </MenuItem>
        </ElevatedTooltip>
        <MenuItem divider disabled>
          <Trans>Delete</Trans>
        </MenuItem>
        <ElevatedTooltip
          title={t`Removes all programs from custom show`}
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
            <Trans>Clear All</Trans>
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
