import { getLinguiToDayjsLocale } from '@/helpers/localeLoader.ts';
import useStore from '@/store';
import originalDayjs from 'dayjs';
import React, { useEffect, useMemo } from 'react';
import type { ContextType } from './DayjsContext.tsx';
import { DayjsContext } from './DayjsContext.tsx';

type Props = {
  children: React.ReactNode | React.ReactNode[];
};

export const DayjsProvider = ({ children }: Props) => {
  const locale = useStore((store) => store.settings.ui.i18n.locale);
  const timeFormat = useStore((store) => store.settings.ui.i18n.timeFormat);

  const effectiveDayjsLocale = useMemo(() => {
    if (timeFormat === '12h') return 'en';
    if (timeFormat === '24h') return 'en-gb';
    return getLinguiToDayjsLocale(locale);
  }, [locale, timeFormat]);

  // Async-load the dayjs locale module if needed (handles stored locale on startup
  // and the 'en-gb' module for 24h format)
  useEffect(() => {
    const load = async () => {
      if (effectiveDayjsLocale !== 'en') {
        await import(`dayjs/locale/${effectiveDayjsLocale}.js`);
      }
      originalDayjs.locale(effectiveDayjsLocale);
    };
    void load();
  }, [effectiveDayjsLocale]);

  const value = useMemo(() => {
    originalDayjs.locale(effectiveDayjsLocale);
    return {
      dayjs: (date?: originalDayjs.ConfigType) => {
        return originalDayjs(date);
      },
    } satisfies ContextType;
  }, [effectiveDayjsLocale]);

  return (
    <DayjsContext.Provider value={value}>{children}</DayjsContext.Provider>
  );
};
