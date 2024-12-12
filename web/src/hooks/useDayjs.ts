import { DayjsContext } from '@/providers/DayjsProvider';
import { useContext } from 'react';

export const useDayjs = () => {
  return useContext(DayjsContext).dayjs;
};
