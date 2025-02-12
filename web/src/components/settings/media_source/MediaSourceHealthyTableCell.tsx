import { CloudDoneOutlined, CloudOff } from '@mui/icons-material';
import type { MediaSourceSettings } from '@tunarr/types';
import { isNull, isUndefined } from 'lodash-es';
import { useApiQuery } from '../../../hooks/useApiQuery.ts';
import { RotatingLoopIcon } from '../../base/LoadingIcon.tsx';

type Props = {
  mediaSource: MediaSourceSettings;
};

export const MediaSourceHealthyTableCell = ({ mediaSource }: Props) => {
  const {
    data: backendStatus,
    isLoading: backendStatusLoading,
    error: backendStatusError,
  } = useApiQuery({
    queryKey: ['settings', 'media-sources', mediaSource.id, 'status'],
    queryFn: (apiClient) =>
      apiClient.getMediaSourceStatus({ params: { id: mediaSource.id } }),
    staleTime: 1000 * 60 * 5,
  });

  const backendHealthy =
    isNull(backendStatusError) &&
    !isUndefined(backendStatus) &&
    backendStatus.healthy;

  return backendStatusLoading ? (
    <RotatingLoopIcon />
  ) : backendHealthy ? (
    <CloudDoneOutlined color="success" />
  ) : (
    <CloudOff color="error" />
  );
};
