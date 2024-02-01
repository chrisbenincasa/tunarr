import { Theme } from '@tunarr/types';
import { StateCreator } from 'zustand';

export interface ThemeEditorState {
  darkMode: boolean;
  pathway: string;
}

export const initialThemeEditorState: Theme = {
  darkMode: false,
  pathway: '',
};

export const createThemeEditorState: StateCreator<ThemeEditorState> = () => {
  return initialThemeEditorState;
};
