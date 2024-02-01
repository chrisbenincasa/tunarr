import useStore from '..';
import { Theme } from '@tunarr/types';
import { initialThemeEditorState } from './store.ts';

export const setDarkModeState = () => {
  useStore.setState((theme) => {
    theme.darkMode = !theme.darkMode;
  });
};

export const updatePathwayState = (newPathway: string) => {
  useStore.setState((theme) => {
    theme.pathway = newPathway;
  });
};

export const resetPathwayState = () => {
  useStore.setState((theme) => {
    theme.pathway = '';
  });
};

export const resetThemeEditorState = () => {
  useStore.setState((state) => {
    const newState = {
      ...state,
      ...initialThemeEditorState,
    };

    return newState;
  });
};
