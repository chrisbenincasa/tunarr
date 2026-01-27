import { DayjsContext } from '@/providers/DayjsContext';
import { useContext } from 'react';

export const useDayjs = () => {
  return useContext(DayjsContext);
};

export const useDayjsUtc = () => {};

export const useLocaleData = () => {
  return useDayjs()().localeData();
};
