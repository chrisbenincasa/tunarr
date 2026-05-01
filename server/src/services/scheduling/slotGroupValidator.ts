import {
  slotIsLinkable,
  type BaseSlot,
  type LinkableBaseSlot,
} from '@tunarr/types/api';
import { map, uniqBy } from 'lodash-es';
import { slotIteratorKey } from './ProgramIterator.js';

type ValidationResult<T> = {
  valid: boolean;
  errors: string[];
  sanitizedSlots: T[];
};

export function validateSlotGroups<T extends BaseSlot>(
  slots: T[],
): ValidationResult<T> {
  const errors: string[] = [];

  const sanitizedSlots = slots.map((slot): T => {
    if (!slotIsLinkable(slot)) return slot;
    if (slot.linkMode && !slot.iterationGroup) {
      const { linkMode: _, ...rest } = slot;
      return rest as T;
    }
    return slot;
  });

  const groups = new Map<string, LinkableBaseSlot[]>();

  for (const slot of sanitizedSlots) {
    if (!slotIsLinkable(slot)) continue;
    if (!slot.iterationGroup) continue;

    let group = groups.get(slot.iterationGroup);
    if (!group) {
      group = [];
      groups.set(slot.iterationGroup, group);
    }

    group.push(slot);
  }

  for (const [groupId, slots] of groups) {
    const slotOrders = uniqBy(slots, (slot) => slot.order);
    if (slotOrders.length > 1) {
      errors.push(
        `Group ${groupId} has mismatched orderings: ${slotOrders.map((slot) => slot.order).join(', ')}`,
      );
    }
    const slotDirections = uniqBy(slots, (slot) => slot.direction);
    if (slotDirections.length > 1) {
      errors.push(
        `Group ${groupId} has mismatched direction values: ${slotDirections.map((slot) => slot.direction).join(', ')}`,
      );
    }
    const slotContentKeys = new Set(
      map(slots, (slot) => slotIteratorKey(slot)),
    );
    if (slotContentKeys.size > 1) {
      errors.push(
        `Group ${groupId} has mismatched content keys: ${[...slotContentKeys].join(', ')}`,
      );
    }
    const slotLinkModes = new Set(
      map(slots, (slot) => slot.linkMode ?? 'continue'),
    );
    if (slotLinkModes.size > 1) {
      if (!slotLinkModes.has('continue')) {
        errors.push(
          `Group ${groupId} has rerun slots but no continue slot to produce content.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedSlots,
  };
}
