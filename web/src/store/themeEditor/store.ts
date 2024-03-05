import dayjs from 'dayjs';
import { StateCreator } from 'zustand';

export interface ThemeEditorStateInner {
  darkMode?: boolean | undefined;
  pathway: string;
  guideDuration: number;
  programmingSelectorView: string;
}

export interface ThemeEditorState {
  theme: ThemeEditorStateInner;
}

export const initialThemeEditorState: ThemeEditorState = {
  theme: {
    darkMode: undefined,
    pathway: '',
    guideDuration: dayjs.duration(2, 'hour').asMilliseconds(),
    programmingSelectorView: 'list',
  },
};

export const createThemeEditorState: StateCreator<ThemeEditorState> = () => {
  return initialThemeEditorState;
};
