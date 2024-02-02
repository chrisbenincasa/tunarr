import useStore from '..';
import { initialThemeEditorState } from './store.ts';

export const setDarkModeState = () => {
  useStore.setState((state) => {
    state.theme.darkMode = !state.theme.darkMode;
  });
};

export const updatePathwayState = (newPathway: string) => {
  useStore.setState((state) => {
    state.theme.pathway = newPathway;
  });
};

export const resetPathwayState = () => {
  useStore.setState((state) => {
    state.theme.pathway = '';
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
