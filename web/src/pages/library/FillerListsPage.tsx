import { Trans } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { FillerList } from '@tunarr/types';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import { AssignFillerToChannelsDialog } from '../../components/fillers/AssignFillerToChannelsDialog.tsx';
import { FillerListsView } from '../../components/fillers/FillerListsView.tsx';
import {
  deleteApiFillerListsByIdMutation,
  getApiFillerListsQueryKey,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';

export default function FillerListsPage() {
  const { data: fillerLists } = useFillerLists();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const [assignFiller, setAssignFiller] = useState<FillerList | null>(null);

  const deleteFillerList = useMutation({
    ...deleteApiFillerListsByIdMutation(),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: getApiFillerListsQueryKey(),
        exact: false,
      });
    },
    onError: (e) => {
      snackbar.enqueueSnackbar({
        message: (
          <Trans>
            <span>
              Error deleting filler list: {e.message}
              <br />
              Please consider opening a bug with details!
            </span>
          </Trans>
        ),
        variant: 'error',
      });
      console.error(e);
    },
  });

  const openFiller = useCallback(
    (filler: FillerList) => {
      navigate({
        to: '/library/fillers/$fillerId/edit',
        params: { fillerId: filler.id },
      }).catch(console.error);
    },
    [navigate],
  );

  return (
    <>
      <FillerListsView
        fillers={fillerLists}
        onOpenFiller={openFiller}
        onAssignChannels={setAssignFiller}
        onDeleteFiller={(filler) => {
          deleteFillerList.mutate({ path: { id: filler.id } });
        }}
      />
      {assignFiller && (
        <AssignFillerToChannelsDialog
          open
          onClose={() => setAssignFiller(null)}
          fillerId={assignFiller.id}
          fillerName={assignFiller.name}
        />
      )}
    </>
  );
}
