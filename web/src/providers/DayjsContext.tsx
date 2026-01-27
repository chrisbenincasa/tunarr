import originalDayjs from 'dayjs';
import React from 'react';

const defaultContextType: typeof originalDayjs = originalDayjs;

export const DayjsContext =
  React.createContext<typeof originalDayjs>(defaultContextType);

// export type ContextType = {
//   dayjs: (date?: originalDayjs.ConfigType) => originalDayjs.Dayjs;
// };
