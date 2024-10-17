import { useBackendUrl } from '@/store/settings/selectors';

export const useM3ULink = () => {
  const backendUrl = useBackendUrl();
  return `${backendUrl}/api/channels.m3u`;
};
