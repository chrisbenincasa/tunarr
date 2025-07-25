import useStore from '@/store';
import originalDayjs from 'dayjs';
import React, { useMemo } from 'react';
import type { ContextType } from './DayjsContext.tsx';
import { DayjsContext } from './DayjsContext.tsx';

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
