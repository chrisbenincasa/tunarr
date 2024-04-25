import { useContext } from 'react';
import { TunarrApiContext } from '../components/TunarrApiContext';

export const useTunarrApi = () => {
  return useContext(TunarrApiContext);
};
