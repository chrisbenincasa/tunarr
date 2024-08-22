import { useQuery } from '@tanstack/react-query';
import { PlexTagResult } from '@tunarr/types/plex';
import useStore from '../../store/index.ts';
import { useTunarrApi } from '../useTunarrApi.ts';
import { plexQueryOptions } from './plexHookUtil.ts';
import { tag } from '@tunarr/types';
import { useCurrentMediaSource } from '@/store/programmingSelector/selectors.ts';

export const usePlexTags = (key: string) => {
  const apiClient = useTunarrApi();
  const selectedServer = useCurrentMediaSource();
  const selectedLibrary = useStore((s) =>
    s.currentLibrary?.type === 'plex' ? s.currentLibrary : null,
  );
  const path = selectedLibrary
    ? `/library/sections/${selectedLibrary.library.key}/${key}`
    : '';

  return useQuery<PlexTagResult>({
    ...plexQueryOptions(apiClient, selectedServer?.id ?? tag(''), path),
  });
};
