import {
  BaseSlotOrdering,
  MidRollConfigSchema,
  SlotFiller,
  SlotProgrammingFillerOrder,
} from '@tunarr/types/api';
import {
  CustomShowSchema,
  FillerListSchema,
  Show,
  SmartCollection,
} from '@tunarr/types/schemas';
import type { FieldArrayWithId } from 'react-hook-form';
import z from 'zod';
import type { RandomSlotForm } from './SlotModels.ts';
import type { TimeSlotForm } from './TimeSlotModels.ts';

export const LinkModeSchema = z.enum(['continue', 'rerun']);
export type LinkMode = z.infer<typeof LinkModeSchema>;

export const RerunOverflowSchema = z.enum(['flex', 'continue']);
export type RerunOverflow = z.infer<typeof RerunOverflowSchema>;

const LinkableSlot = z.object({
  id: z.uuid(),
  iterationGroup: z.uuid().optional(),
  linkMode: LinkModeSchema.default('continue').optional(),
  rerunOverflow: RerunOverflowSchema.default('flex').optional(),
});

export type LinkableSlot = z.infer<typeof LinkableSlot>;

export const WithSlotFiller = z.object({
  filler: z.array(SlotFiller).optional(),
  midRoll: MidRollConfigSchema.optional(),
});

export type WithSlotFiller = z.infer<typeof WithSlotFiller>;

export const CommonMovieSlotViewModel = z.object({
  ...LinkableSlot.shape,
  ...BaseSlotOrdering.shape,
  ...WithSlotFiller.shape,
  type: z.literal('movie'),
});

export const CommonCustomShowSlotViewModel = z.object({
  ...LinkableSlot.shape,
  ...BaseSlotOrdering.shape,
  ...WithSlotFiller.shape,
  type: z.literal('custom-show'),
  customShowId: z.uuid(),
  customShow: CustomShowSchema.omit({
    programs: true,
    totalDuration: true,
  }).nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type CommonCustomShowSlotViewModel = z.infer<
  typeof CommonCustomShowSlotViewModel
>;

export const CommonFillerSlotViewModel = z.object({
  ...LinkableSlot.shape,
  type: z.literal('filler'),
  fillerListId: z.uuid(),
  order: SlotProgrammingFillerOrder,
  durationWeighting: z.enum(['linear', 'log']),
  decayFactor: z.number().gte(0).lt(1),
  recoveryFactor: z.number().gte(0).lt(1),
  fillerList: FillerListSchema.nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type CommonFillerSlotViewModel = z.infer<
  typeof CommonFillerSlotViewModel
>;

export const CommonShowSlotViewModel = z.object({
  ...LinkableSlot.shape,
  ...BaseSlotOrdering.shape,
  ...WithSlotFiller.shape,
  type: z.literal('show'),
  showId: z.string(),
  show: Show.nullable(),
  missingShow: z
    .object({
      title: z.string().optional(),
    })
    .optional(),
  seasonFilter: z.number().array().default([]),
  seasonExcludeFilter: z.number().array().default([]),
});

export type CommonShowSlotViewModel = z.infer<typeof CommonShowSlotViewModel>;

export const CommonFlexSlotViewModel = z.object({
  type: z.literal('flex'),
});

export const CommonRedirectSlotViewModel = z.object({
  type: z.literal('redirect'),
  channelId: z.string(),
});

export const CommonSmartCollectionViewModel = z.object({
  ...LinkableSlot.shape,
  ...BaseSlotOrdering.shape,
  ...WithSlotFiller.shape,
  type: z.literal('smart-collection'),
  smartCollectionId: z.uuid(),
  smartCollection: SmartCollection.nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type CommonSmartCollectionViewModel = z.infer<
  typeof CommonSmartCollectionViewModel
>;

export const CommonSlotViewModel = z.discriminatedUnion('type', [
  CommonMovieSlotViewModel,
  CommonCustomShowSlotViewModel,
  CommonFillerSlotViewModel,
  CommonShowSlotViewModel,
  CommonFlexSlotViewModel,
  CommonRedirectSlotViewModel,
  CommonSmartCollectionViewModel,
]);

export type CommonSlotViewModel = z.infer<typeof CommonSlotViewModel>;

export type LinkableSlotViewModel = Extract<
  CommonSlotViewModel,
  { type: 'movie' | 'show' | 'custom-show' | 'smart-collection' | 'filler' }
>;

export function slotIsLinkable(
  slot: CommonSlotViewModel,
): slot is LinkableSlotViewModel {
  switch (slot.type) {
    case 'custom-show':
    case 'filler':
    case 'movie':
    case 'show':
    case 'smart-collection':
      return true;
    case 'flex':
    case 'redirect':
      return false;
  }
}

export type SlotLinkingContent =
  | {
      type: 'movie';
      order: z.infer<typeof BaseSlotOrdering>['order'];
      direction: z.infer<typeof BaseSlotOrdering>['direction'];
      filler?: WithSlotFiller['filler'];
      midRoll?: WithSlotFiller['midRoll'];
    }
  | {
      type: 'show';
      showId: string;
      show: CommonShowSlotViewModel['show'];
      missingShow?: CommonShowSlotViewModel['missingShow'];
      order: z.infer<typeof BaseSlotOrdering>['order'];
      direction: z.infer<typeof BaseSlotOrdering>['direction'];
      seasonFilter: number[];
      seasonExcludeFilter: number[];
      filler?: WithSlotFiller['filler'];
      midRoll?: WithSlotFiller['midRoll'];
    }
  | {
      type: 'custom-show';
      customShowId: string;
      customShow: CommonCustomShowSlotViewModel['customShow'];
      order: z.infer<typeof BaseSlotOrdering>['order'];
      direction: z.infer<typeof BaseSlotOrdering>['direction'];
      isMissing: boolean;
      filler?: WithSlotFiller['filler'];
      midRoll?: WithSlotFiller['midRoll'];
    }
  | {
      type: 'smart-collection';
      smartCollectionId: string;
      smartCollection: CommonSmartCollectionViewModel['smartCollection'];
      order: z.infer<typeof BaseSlotOrdering>['order'];
      direction: z.infer<typeof BaseSlotOrdering>['direction'];
      isMissing: boolean;
      filler?: WithSlotFiller['filler'];
      midRoll?: WithSlotFiller['midRoll'];
    }
  | {
      type: 'filler';
      fillerListId: string;
      fillerList: CommonFillerSlotViewModel['fillerList'];
      order: CommonFillerSlotViewModel['order'];
      durationWeighting: CommonFillerSlotViewModel['durationWeighting'];
      decayFactor: number;
      recoveryFactor: number;
      isMissing: boolean;
    };

export function copySlotForLinking(
  slot: LinkableSlotViewModel,
): SlotLinkingContent {
  switch (slot.type) {
    case 'movie':
      return {
        type: 'movie',
        order: slot.order,
        direction: slot.direction,
        filler: slot.filler,
        midRoll: slot.midRoll,
      };
    case 'show':
      return {
        type: 'show',
        showId: slot.showId,
        show: slot.show,
        missingShow: slot.missingShow,
        order: slot.order,
        direction: slot.direction,
        seasonFilter: [...slot.seasonFilter],
        seasonExcludeFilter: [...slot.seasonExcludeFilter],
        filler: slot.filler,
        midRoll: slot.midRoll,
      };
    case 'custom-show':
      return {
        type: 'custom-show',
        customShowId: slot.customShowId,
        customShow: slot.customShow,
        order: slot.order,
        direction: slot.direction,
        isMissing: slot.isMissing,
        filler: slot.filler,
        midRoll: slot.midRoll,
      };
    case 'smart-collection':
      return {
        type: 'smart-collection',
        smartCollectionId: slot.smartCollectionId,
        smartCollection: slot.smartCollection,
        order: slot.order,
        direction: slot.direction,
        isMissing: slot.isMissing,
        filler: slot.filler,
        midRoll: slot.midRoll,
      };
    case 'filler':
      return {
        type: 'filler',
        fillerListId: slot.fillerListId,
        fillerList: slot.fillerList,
        order: slot.order,
        durationWeighting: slot.durationWeighting,
        decayFactor: slot.decayFactor,
        recoveryFactor: slot.recoveryFactor,
        isMissing: slot.isMissing,
      };
  }
}

export type ProgramTooLongWarning = {
  type: 'program_too_long';
  programs: { id: string; duration: number }[];
};

export type SlotWarning = ProgramTooLongWarning;

type TimeSlotTableDataType = FieldArrayWithId<TimeSlotForm, 'slots'>;
type RandomSlotTableDataType = FieldArrayWithId<RandomSlotForm, 'slots'>;

export type SlotTableWarnings = {
  warnings: SlotWarning[];
  programCount: number;
  durationMs?: number;
};

export type TimeSlotTableRowType = TimeSlotTableDataType &
  SlotTableWarnings & {
    originalIndex: number;
  };

export type RandomSlotTableRowType = RandomSlotTableDataType &
  SlotTableWarnings;
