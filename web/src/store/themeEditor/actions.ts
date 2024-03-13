import { ProgramSelectorViewType } from '../../types/index.ts';
import useStore from '../index.ts';
import { initialThemeEditorState } from './store.ts';

export const setGuideDurationState = (duration: number) => {
  useStore.setState((state) => {
    state.theme.guideDuration = duration;
  });
};

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

export const setProgrammingSelectorViewState = (
  view: ProgramSelectorViewType,
) => {
  useStore.setState((state) => {
    state.theme.programmingSelectorView = view;
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
