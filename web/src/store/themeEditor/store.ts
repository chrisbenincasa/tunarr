import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import type { StateCreator } from 'zustand';
import type { ProgramSelectorViewType } from '../../types';
import type { Density } from '../../themeTokens.ts';

dayjs.extend(duration);

export interface ThemeEditorStateInner {
  darkMode?: boolean | undefined;
  themePreference?: 'light' | 'dark' | 'system';
  showWelcome: boolean;
  guideDuration: number;
  programmingSelectorView: ProgramSelectorViewType;
  density?: Density;
}

export interface ThemeEditorState {
  theme: ThemeEditorStateInner;
}

export const initialThemeEditorState: ThemeEditorState = {
  theme: {
    darkMode: undefined,
    showWelcome: true,
    guideDuration: dayjs.duration(2, 'hour').asMilliseconds(),
    themePreference: 'system',
    programmingSelectorView: 'grid',
    density: 'comfortable',
  },
};

export const createThemeEditorState: StateCreator<ThemeEditorState> = () => {
  return initialThemeEditorState;
};
