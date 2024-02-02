import { Theme } from '@tunarr/types';
import { StateCreator } from 'zustand';

export interface ThemeEditorState {
  darkMode?: boolean | undefined;
  pathway: string;
}

export const initialThemeEditorState: Theme = {
  darkMode: undefined,
  pathway: '',
};

export const createThemeEditorState: StateCreator<ThemeEditorState> = () => {
  return initialThemeEditorState;
};
