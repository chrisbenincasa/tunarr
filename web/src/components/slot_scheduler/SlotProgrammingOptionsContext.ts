import React from 'react';
import type { ProgramOption } from '../../helpers/slotSchedulerUtil.ts';

export const SlotProgrammingOptionsContext =
  React.createContext<SlotProgrammingOptionsContext>([]);

export type SlotProgrammingOptionsContext = ProgramOption[];
