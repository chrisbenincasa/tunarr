import { createContext, Dispatch, SetStateAction } from 'react';

export type ChannelEditContextState = {
  currentTabValid: boolean;
  isNewChannel: boolean;
};

export const ChannelEditContext = createContext<{
  channelEditorState: ChannelEditContextState;
  setChannelEditorState: Dispatch<SetStateAction<ChannelEditContextState>>;
} | null>(null);
