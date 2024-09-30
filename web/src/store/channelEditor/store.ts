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

export type CurrentEntityEditor = {
  type: 'channel' | 'custom_show' | 'filler_list';
  id: string | null;
};

// Represents a program listing in the editor
export interface EntityState<EntityType extends HasId, ProgramType> {
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

export type ChannelEditorState = EntityState<
  Channel,
  UICondensedChannelProgram
> & {
  schedule?: LineupSchedule;
  dynamicContentConfiguration?: DynamicContentConfig;
};

export type FillerListEditor = EntityState<
  FillerList,
  ContentProgram | CustomProgram // You cannot add Flex to custom shows
>;

export interface EditorsState {
  currentEditor: CurrentEntityEditor | null;
  channelEditor: ChannelEditorState;
  channels: Record<string, ChannelEditorState>;
  customShowEditor: EntityState<
    CustomShow,
    ContentProgram | CustomProgram // You cannot add Flex to custom shows
  >;
  fillerListEditor: EntityState<
    FillerList,
    ContentProgram | CustomProgram // You cannot add Flex to custom shows
  >;
  // Since for channels we deal with 'condensed' programs, we need to have
  // the lookup record for programs by ID
  programLookup: Record<string, ContentProgram>;
}

export const initialChannelEditorState: EditorsState = {
  channelEditor: { ...emptyEntityEditor() },
  currentEditor: null,
  channels: {},
  programLookup: {},
  customShowEditor: emptyEntityEditor(),
  fillerListEditor: emptyEntityEditor(),
};

export const createChannelEditorState: StateCreator<EditorsState> = () => {
  return initialChannelEditorState;
};
