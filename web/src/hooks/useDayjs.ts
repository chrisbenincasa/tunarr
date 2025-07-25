import { DayjsContext } from '@/providers/DayjsContext';
import { useContext } from 'react';

export const useDayjs = () => {
  return useContext(DayjsContext).dayjs;
};
