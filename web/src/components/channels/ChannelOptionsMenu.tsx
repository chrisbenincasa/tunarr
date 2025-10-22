import type { channelListOptions } from '@/types/index.ts';
import {
  ContentCopy,
  CopyAll,
  Delete,
  Edit,
  Stop,
  Tv,
} from '@mui/icons-material';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Channel } from '@tunarr/types';
import { isEmpty, trimEnd } from 'lodash-es';
import type { SyntheticEvent } from 'react';
import { useCallback, useState } from 'react';
import { deleteApiChannelsByIdSessionsMutation } from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard.ts';
import { useCreateChannel } from '../../hooks/useCreateChannel.ts';
import { useSettings } from '../../store/settings/selectors.ts';
import type { PopoverAnchorEl } from '../../types/dom.ts';
import { ChannelDeleteDialog } from './ChannelDeleteDialog.tsx';

type Props = {
  row: Channel;
  anchorEl: PopoverAnchorEl;
  open: boolean;
  onClose: (e?: SyntheticEvent) => void;
  hideItems?: channelListOptions[];
};

export const ChannelOptionsMenu = ({
  row,
  anchorEl,
  open,
  onClose,
  hideItems,
}: Props) => {
  const { backendUri } = useSettings();
  const copyToClipboard = useCopyToClipboard();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const queryClient = useQueryClient();
  const stopSessionsMutation = useMutation({
    ...deleteApiChannelsByIdSessionsMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries(['Channels']),
      });
    },
  });

  const handleStopSessions = useCallback(
    (channelId: string) => {
      stopSessionsMutation.mutate({ path: { id: channelId } });
    },
    [stopSessionsMutation],
  );

  const duplicateChannelMutation = useCreateChannel();

  const handleClose = useCallback(
    (e: SyntheticEvent) => {
      e.stopPropagation();
      onClose(e);
    },
    [onClose],
  );

  const { id: channelId, name: channelName, sessions } = row;

  return (
    <>
      <Menu
        id="channel-options-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          list: {
            'aria-labelledby': 'channel-options-button',
          },
        }}
      >
        {!hideItems?.includes('edit') ? (
          <MenuItem
            to={`/channels/${channelId}/edit`}
            component={Link}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <ListItemIcon>
              <Edit />
            </ListItemIcon>
            <ListItemText>Edit Channel</ListItemText>
          </MenuItem>
        ) : null}

        {!hideItems?.includes('programming') ? (
          <MenuItem
            to={`/channels/${channelId}/programming`}
            component={Link}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <ListItemIcon>
              <Edit />
            </ListItemIcon>
            <ListItemText>Modify Programming</ListItemText>
          </MenuItem>
        ) : null}

        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            const base = isNonEmptyString(backendUri)
              ? backendUri
              : window.location.origin;
            const url = `${trimEnd(
              base,
              '/',
            )}/stream/channels/${row.number}.m3u8`;
            copyToClipboard(
              url,
              `Copied channel "${channelName}" m3u link to clipboard`,
              'Error copying channel m3u link to clipboard',
            )
              .catch(console.error)
              .finally(() => {
                onClose();
              });
          }}
        >
          <ListItemIcon>
            <ContentCopy />
          </ListItemIcon>
          <ListItemText>Copy M3U URL</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(channelId, 'Copied Channel ID!')
              .catch(console.error)
              .finally(() => {
                onClose(e);
              });
          }}
        >
          <ListItemIcon>
            <ContentCopy />
          </ListItemIcon>
          <ListItemText>Copy Channel ID</ListItemText>
        </MenuItem>

        {!hideItems?.includes('watch') ? (
          <MenuItem
            component={Link}
            to={`/channels/${channelId}/watch`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <ListItemIcon>
              <Tv />
            </ListItemIcon>
            <ListItemText>Watch Channel</ListItemText>
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            handleStopSessions(channelId);
            onClose(e);
          }}
          disabled={isEmpty(sessions)}
        >
          <ListItemIcon>
            <Stop />
          </ListItemIcon>
          <ListItemText primary={`Stop Transcode Session`} />
        </MenuItem>
        {!hideItems?.includes('duplicate') && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              duplicateChannelMutation.mutate({
                body: {
                  type: 'copy',
                  channelId,
                },
              });
              handleClose(e);
            }}
          >
            <ListItemIcon>
              <CopyAll />{' '}
            </ListItemIcon>
            <ListItemText>Duplicate Channel</ListItemText>
          </MenuItem>
        )}
        {!hideItems?.includes('delete') && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmOpen(true);
            }}
          >
            <ListItemIcon>
              <Delete />
            </ListItemIcon>
            <ListItemText>Delete Channel</ListItemText>
          </MenuItem>
        )}
      </Menu>
      <ChannelDeleteDialog
        open={deleteConfirmOpen}
        onClose={(e) => {
          setDeleteConfirmOpen(false);
          handleClose(e);
        }}
        channel={row}
      />
    </>
  );
};
