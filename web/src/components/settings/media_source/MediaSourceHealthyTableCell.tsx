import { CloudDoneOutlined, CloudOff } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { MediaSourceSettings } from '@tunarr/types';
import { isNull, isUndefined } from 'lodash-es';
import { getApiMediaSourcesByIdStatusOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { RotatingLoopIcon } from '../../base/LoadingIcon.tsx';

type Props = {
  mediaSource: MediaSourceSettings;
};

export const MediaSourceHealthyTableCell = ({ mediaSource }: Props) => {
  const {
    data: backendStatus,
    isLoading: backendStatusLoading,
    error: backendStatusError,
  } = useQuery({
    ...getApiMediaSourcesByIdStatusOptions({ path: { id: mediaSource.id } }),
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
