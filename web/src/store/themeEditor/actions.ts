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

export const updateShowWelcomeState = () => {
  useStore.setState((state) => {
    state.theme.showWelcome = !state.theme.showWelcome;
  });
};

export const setShowWelcome = (show: boolean) =>
  useStore.setState((state) => {
    state.theme.showWelcome = show;
  });

export const resetShowWelcomeState = () => {
  useStore.setState((state) => {
    state.theme.showWelcome = true;
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
