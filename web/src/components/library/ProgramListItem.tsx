import { Trans } from '@lingui/react/macro';
import { Info } from '@mui/icons-material';
import {
  Button,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import type { ProgramOrFolder } from '@tunarr/types';
import {
  getChildCount,
  isStructuralItemType,
  isTerminalItemType,
} from '@tunarr/types';
import { useToggle } from '@uidotdev/usehooks';
import { map } from 'lodash-es';
import type { MouseEvent } from 'react';
import { Fragment, useCallback } from 'react';
import { typedProperty } from '../../helpers/util.ts';
import {
  addSelectedMedia,
  removeMediaSourceSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import {
  useCurrentMediaSource,
  useSelectedMedia,
} from '../../store/programmingSelector/selectors.ts';
import { ProgramTypeIcon } from '../base/ProgramTypeIcon.tsx';
import ProgramDetailsDialog from '../programs/ProgramDetailsDialog.tsx';
import { ProgramSubtitle } from './extractSubtitle.tsx';

interface ProgramListItemProps {
  item: ProgramOrFolder;
  style?: React.CSSProperties;
  index?: number;
  length?: number;
  parent?: string;
  onPushParent: (item: ProgramOrFolder) => void;
  disableSelection?: boolean;
}
export const ProgramListItem = ({
  item,
  style,
  onPushParent,
  disableSelection,
}: ProgramListItemProps) => {
  const selectedServer = useCurrentMediaSource();
  const selectedMedia = useSelectedMedia();
  const selectedMediaIds = map(selectedMedia, typedProperty('id'));
  const [dialogOpen, setDialogOpen] = useToggle();
  const handleClick = () => {
    if (!isTerminalItemType(item)) {
      onPushParent(item);
    }
  };
  const handleItem = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (selectedMediaIds.includes(item.uuid)) {
        removeMediaSourceSelectedMedia([
          {
            sourceType: item.sourceType,
            id: item.uuid,
            mediaSourceId: item.mediaSourceId,
          },
        ]);
      } else {
        addSelectedMedia({
          type: item.sourceType,
          mediaSource: selectedServer!,
          id: item.uuid,
          libraryId: item.libraryId,
        });
      }
    },
    [item, selectedServer, selectedMediaIds],
  );

  return (
    <Fragment key={item.uuid}>
      <ListItem
        divider
        disablePadding
        style={style}
        secondaryAction={
          isStructuralItemType(item) ? null : (
            <IconButton edge="end" onClick={() => setDialogOpen(true)}>
              <Info />{' '}
            </IconButton>
          )
        }
      >
        <ListItemButton
          disabled={
            !isTerminalItemType(item) &&
            item.sourceType !== 'local' &&
            (item.childCount === 0 || (getChildCount(item) ?? 0) === 0)
          }
          onClick={handleClick}
          dense
          sx={{
            width: '100%',
            cursor: isTerminalItemType(item) ? 'default' : undefined,
          }}
        >
          <ListItemIcon>
            <ProgramTypeIcon programType={item.type} />
          </ListItemIcon>
          <ListItemText
            primary={item.title}
            secondary={ProgramSubtitle(item)}
          />
          {!disableSelection && (
            <Button
              disabled={
                !isTerminalItemType(item) && (item.childCount ?? 0) === 0
              }
              onClick={(e) => handleItem(e)}
              variant="contained"
            >
              {!isTerminalItemType(item) && (item.childCount ?? 0) > 0
                ? <Trans>Add {item.type}</Trans>
                : selectedMediaIds.includes(item.uuid)
                  ? <Trans>Remove</Trans>
                  : <Trans>Add</Trans>}
            </Button>
          )}
        </ListItemButton>
      </ListItem>
      {!isStructuralItemType(item) && (
        <ProgramDetailsDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          programId={item.uuid}
          programType={item.type}
        />
      )}
    </Fragment>
  );
};
