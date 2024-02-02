import { StateCreator } from 'zustand';

export interface ThemeEditorStateInner {
  darkMode?: boolean | undefined;
  pathway: string;
}

export interface ThemeEditorState {
  theme: ThemeEditorStateInner;
}

export const initialThemeEditorState: ThemeEditorState = {
  theme: {
    darkMode: undefined,
    pathway: '',
  },
};

export const createThemeEditorState: StateCreator<ThemeEditorState> = () => {
  return initialThemeEditorState;
};
