import { emptyEntityEditor } from '@/store/entityEditor/util.ts';
import { UICondensedChannelProgram, UIIndex } from '@/types/index.ts';
import {
  Channel,
  ContentProgram,
  CustomProgram,
  CustomShow,
  FillerList,
} from '@tunarr/types';
import { DynamicContentConfig, LineupSchedule } from '@tunarr/types/api';
import { StateCreator } from 'zustand';

export type HasId = { id: string };

// Represents a program listing in the editor
export interface ProgrammingEditorState<EntityType extends HasId, ProgramType> {
  // Original state of the working entity. Used to reset state
  originalEntity?: EntityType;
  // The working entity - edits should be made directly here
  currentEntity?: EntityType;
  currentEntityId?: string;
  // The programs in the state they were when we fetched them
  // This can be used to reset the state of the editor and
  // start over changes without having to close/enter the page
  originalProgramList: (ProgramType & UIIndex)[];
  // The actively edited list
  programList: (ProgramType & UIIndex)[];
  programsLoaded: boolean;
  dirty: {
    programs: boolean;
  };
}

export type ChannelEditorState = ProgrammingEditorState<
  Channel,
  UICondensedChannelProgram
> & {
  schedule?: LineupSchedule;
  dynamicContentConfiguration?: DynamicContentConfig;
};

export type FillerListEditor = ProgrammingEditorState<
  FillerList,
  ContentProgram | CustomProgram // You cannot add Flex to custom shows
>;

export interface EditorsState {
  channelEditor: ChannelEditorState;
  channels: Record<string, ChannelEditorState>;
  customShowEditor: ProgrammingEditorState<
    CustomShow,
    ContentProgram | CustomProgram // You cannot add Flex to custom shows
  >;
  fillerListEditor: ProgrammingEditorState<
    FillerList,
    ContentProgram | CustomProgram // You cannot add Flex to custom shows
  >;
  // Since for channels we deal with 'condensed' programs, we need to have
  // the lookup record for programs by ID
  programLookup: Record<string, ContentProgram>;
}

export const initialChannelEditorState: EditorsState = {
  channelEditor: { ...emptyEntityEditor() },
  channels: {},
  programLookup: {},
  customShowEditor: emptyEntityEditor(),
  fillerListEditor: emptyEntityEditor(),
};

export const createChannelEditorState: StateCreator<EditorsState> = () => {
  return initialChannelEditorState;
};
