import originalDayjs from 'dayjs';
import React from 'react';

const defaultContextType: ContextType = {
  dayjs(date?: originalDayjs.ConfigType) {
    return originalDayjs(date);
  },
};

export const DayjsContext =
  React.createContext<ContextType>(defaultContextType);

export type ContextType = {
  dayjs: (date?: originalDayjs.ConfigType) => originalDayjs.Dayjs;
};
