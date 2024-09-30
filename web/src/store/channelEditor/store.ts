import { emptyEntityEditor } from '@/store/entityEditor/util.ts';
import {
  UIChannelProgram,
  UICondensedChannelProgram,
  UIIndex,
} from '@/types/index.ts';
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

export type EntityType = 'channel' | 'custom_show' | 'filler_list';

export type CurrentEntityEditor = {
  type: EntityType;
  id: string | null;
};

// Represents a program listing in the editor
export interface BaseEntityEditorState<EntityType extends HasId, ProgramType> {
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
  addProgramsInProgress: boolean;
}

export type ChannelEditorState = BaseEntityEditorState<
  Channel,
  UICondensedChannelProgram
> & {
  type: 'channel';
  schedule?: LineupSchedule;
  dynamicContentConfiguration?: DynamicContentConfig;
};

export type MaterializedChannelEditorState = BaseEntityEditorState<
  Channel,
  UIChannelProgram
> & {
  type: 'channel';
  schedule?: LineupSchedule;
  dynamicContentConfiguration?: DynamicContentConfig;
};

export type FillerListEditor = BaseEntityEditorState<
  FillerList,
  ContentProgram | CustomProgram // You cannot add Flex to custom shows
> & {
  type: 'filler_list';
};

export type CustomShowEditor = BaseEntityEditorState<
  CustomShow,
  ContentProgram | CustomProgram // You cannot add Flex to custom shows
> & {
  type: 'custom_show';
};

export interface EditorsState {
  currentEditor: CurrentEntityEditor | null;
  channelEditor: ChannelEditorState;
  channels: Record<string, ChannelEditorState>;
  customShowEditor: CustomShowEditor;
  fillerListEditor: FillerListEditor;
  // Since for channels we deal with 'condensed' programs, we need to have
  // the lookup record for programs by ID
  programLookup: Record<string, ContentProgram>;
}

export const initialChannelEditorState: EditorsState = {
  channelEditor: { ...emptyEntityEditor(), type: 'channel' },
  currentEditor: null,
  channels: {},
  programLookup: {},
  customShowEditor: { ...emptyEntityEditor(), type: 'custom_show' },
  fillerListEditor: { ...emptyEntityEditor(), type: 'filler_list' },
};

export const createChannelEditorState: StateCreator<EditorsState> = () => {
  return initialChannelEditorState;
};
