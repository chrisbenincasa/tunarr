import { useContext } from 'react';
import { TunarrApiContext } from '../context/TunarrApiContext';

export const useTunarrApi = () => {
  return useContext(TunarrApiContext);
};
