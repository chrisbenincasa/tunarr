import { nullToUndefined } from '@tunarr/shared/util';
import type {
  BaseScheduleSlot,
  Schedule,
  ScheduleSlot,
} from '@tunarr/types/api';
import { match, P } from 'ts-pattern';
import type { InfiniteScheduleWithSlots } from '../../db/InfiniteScheduleDB.ts';
import type { InfiniteScheduleSlot } from '../../db/schema/InfiniteScheduleSlot.ts';

export function slotDaoToDto(slot: InfiniteScheduleSlot): ScheduleSlot {
  const base: BaseScheduleSlot = {
    cooldownMs: slot.cooldownMs,
    slotIndex: slot.slotIndex,
    weight: slot.weight,
    anchorDays: slot.anchorDays,
    anchorMode: slot.anchorMode,
    anchorTime: slot.anchorTime,
    fillerConfig: slot.fillerConfig,
    padMs: slot.padMs,
    padToMultiple: slot.padToMultiple,
    uuid: slot.uuid,
  };

  return match(slot)
    .returnType<ScheduleSlot>()
    .with({ showId: P.nonNullable, slotType: 'show' }, (slot) => ({
      ...base,
      type: 'show',
      showId: slot.showId,
      slotConfig: nullToUndefined(slot.slotConfig),
    }))
    .with({ fillerListId: P.nonNullable, slotType: 'filler' }, (slot) => ({
      ...base,
      type: 'filler',
      fillerListId: slot.fillerListId,
      // TODO: order
    }))
    .with(
      { smartCollectionId: P.nonNullable, slotType: 'smart-collection' },
      (slot) => ({
        ...base,
        type: 'smart-collection',
        smartCollectionId: slot.smartCollectionId,
        slotConfig: nullToUndefined(slot.slotConfig),
      }),
    )
    .with({ customShowId: P.nonNullable, slotType: 'custom-show' }, (slot) => ({
      ...base,
      type: 'custom-show',
      customShowId: slot.customShowId,
      slotConfig: nullToUndefined(slot.slotConfig),
    }))
    .with({ slotType: 'flex' }, () => ({
      ...base,
      type: 'flex',
    }))

    .otherwise(() => {
      throw new Error('');
    });
}

export function scheduleDaoToDto(
  schedule: InfiniteScheduleWithSlots,
): Schedule {
  return {
    ...schedule,
    createdAt: schedule.createdAt?.valueOf(),
    updatedAt: schedule.updatedAt?.valueOf(),
    slots: schedule.slots.map(slotDaoToDto),
  };
}
