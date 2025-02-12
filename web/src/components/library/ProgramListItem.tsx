import { Folder } from '@mui/icons-material';
import {
  Button,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { ProgramOrFolder } from '@tunarr/types';
import { map } from 'lodash-es';
import type { MouseEvent } from 'react';
import { Fragment, useCallback } from 'react';
import { match } from 'ts-pattern';
import { typedProperty } from '../../helpers/util.ts';
import {
  addSelectedMedia,
  removeMediaSourceSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import {
  useCurrentMediaSource,
  useSelectedMedia,
} from '../../store/programmingSelector/selectors.ts';
import { extractSubtitle, isTerminalItemType } from './ProgramGridItem.tsx';

export interface ProgramListItemProps {
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
        match(item)
          .with({ sourceType: 'plex' }, (plex) =>
            addSelectedMedia({
              type: 'plex',
              mediaSource: selectedServer!,
              id: plex.uuid,
              libraryId: plex.libraryId,
            }),
          )
          .with({ sourceType: 'jellyfin' }, (jf) =>
            addSelectedMedia({
              type: 'jellyfin',
              mediaSource: selectedServer!,
              id: jf.uuid,
              libraryId: jf.libraryId,
            }),
          )
          .with({ sourceType: 'emby' }, (emby) =>
            addSelectedMedia({
              type: 'emby',
              mediaSource: selectedServer!,
              id: emby.uuid,
              libraryId: emby.libraryId,
            }),
          )
          .exhaustive();
        // const libraryKey =
        //   selectedLibrary?.view.type === 'library'
        //     ? selectedLibrary.view.library.key
        //     : null;
        // const libraryId = selectedServer?.libraries.find(
        //   (lib) => lib.externalKey === libraryKey,
        // )?.id;
        // addPlexSelectedMedia(selectedServer!, libraryId ?? '', [item]);
      }
    },
    [item, selectedServer, selectedMediaIds],
  );
  return (
    <Fragment key={item.uuid}>
      <ListItem divider disablePadding style={style}>
        <ListItemButton
          disabled={!isTerminalItemType(item) && item.childCount === 0}
          onClick={handleClick}
          dense
          sx={{
            width: '100%',
            cursor: isTerminalItemType(item) ? 'default' : undefined,
          }}
        >
          {item.type === 'folder' && (
            <ListItemIcon>
              <Folder />
            </ListItemIcon>
          )}
          <ListItemText
            primary={item.title}
            secondary={extractSubtitle(item)}
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
                ? `Add ${item.type}`
                : selectedMediaIds.includes(item.uuid)
                  ? 'Remove'
                  : `Add`}
            </Button>
          )}
        </ListItemButton>
      </ListItem>
    </Fragment>
  );
};
