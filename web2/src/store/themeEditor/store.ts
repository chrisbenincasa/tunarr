import { StateCreator } from 'zustand';

export interface ThemeEditorStateInner {
  darkMode?: boolean | undefined;
  pathway: string;
  guideDuration: number;
}

export interface ThemeEditorState {
  theme: ThemeEditorStateInner;
}

export const initialThemeEditorState: ThemeEditorState = {
  theme: {
    darkMode: undefined,
    pathway: '',
    guideDuration: 7200000, // 2 hours
  },
};

export const createThemeEditorState: StateCreator<ThemeEditorState> = () => {
  return initialThemeEditorState;
};
