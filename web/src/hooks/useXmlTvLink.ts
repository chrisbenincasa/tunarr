import { useBackendUrl } from '@/store/settings/selectors';
import { trimEnd } from 'lodash-es';

export const useXmlTvLink = () => {
  const backendUri = useBackendUrl();
  return `${trimEnd(backendUri.trim(), '/')}/api/xmltv.xml`;
};
