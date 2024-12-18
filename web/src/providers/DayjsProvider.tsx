import useStore from '@/store';
import originalDayjs from 'dayjs';
import React, { useMemo } from 'react';

type ContextType = {
  dayjs: (date?: originalDayjs.ConfigType) => originalDayjs.Dayjs;
};

const defaultContextType: ContextType = {
  dayjs(date?: originalDayjs.ConfigType) {
    return originalDayjs(date);
  },
};

export const DayjsContext =
  React.createContext<ContextType>(defaultContextType);

type Props = {
  children: React.ReactNode | React.ReactNode[];
};

export const DayjsProvider = ({ children }: Props) => {
  const locale = useStore((store) => store.settings.ui.i18n.locale);
  const value = useMemo(() => {
    originalDayjs.locale(locale);
    return {
      dayjs: (date?: originalDayjs.ConfigType) => {
        return originalDayjs(date);
      },
    } satisfies ContextType;
  }, [locale]);
  return (
    <DayjsContext.Provider value={value}>{children}</DayjsContext.Provider>
  );
};
