import { Trans } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useSnackbar } from 'notistack';
import { CustomShowsView } from '../../components/custom-shows/CustomShowsView.tsx';
import { deleteCustomShowMutation } from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import { useCustomShows } from '../../hooks/useCustomShows.ts';

export default function CustomShowsPage() {
  const { data: customShows } = useCustomShows();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  const deleteShowMutation = useMutation({
    ...deleteCustomShowMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Custom Shows'),
      });
    },
    onError: (e) => {
      snackbar.enqueueSnackbar({
        message: (
          <Trans>
            <span>
              Error deleting playlist: {e.message}
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

  return (
    <CustomShowsView
      shows={customShows}
      onOpenShow={(show) => {
        navigate({
          to: '/library/playlists/$showId/edit',
          params: { showId: show.id },
        }).catch(console.warn);
      }}
      onDeleteShow={(show) => {
        deleteShowMutation.mutate({ path: { id: show.id } });
      }}
    />
  );
}
