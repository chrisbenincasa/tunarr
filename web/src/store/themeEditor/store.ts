import dayjs from 'dayjs';
import { StateCreator } from 'zustand';
import { ProgramSelectorViewType } from '../../types';

export interface ThemeEditorStateInner {
  darkMode?: boolean | undefined;
  showWelcome: boolean;
  guideDuration: number;
  programmingSelectorView: ProgramSelectorViewType;
}

export interface ThemeEditorState {
  theme: ThemeEditorStateInner;
}

export const initialThemeEditorState: ThemeEditorState = {
  theme: {
    darkMode: undefined,
    showWelcome: true,
    guideDuration: dayjs.duration(2, 'hour').asMilliseconds(),
    programmingSelectorView: 'list',
  },
};

export const createThemeEditorState: StateCreator<ThemeEditorState> = () => {
  return initialThemeEditorState;
};
