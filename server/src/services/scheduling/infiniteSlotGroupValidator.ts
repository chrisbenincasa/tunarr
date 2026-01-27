import { infiniteSlotIsLinkable, type ScheduleSlot } from '@tunarr/types/api';

function infiniteSlotContentKey(slot: ScheduleSlot): string | null {
  switch (slot.type) {
    case 'show':
      return `show.${slot.showId}`;
    case 'custom-show':
      return `custom-show.${slot.customShowId}`;
    case 'smart-collection':
      return `smart-collection.${slot.smartCollectionId}`;
    default:
      return null;
  }
}

export function validateInfiniteSlotGroups(slots: ScheduleSlot[]): {
  valid: boolean;
  errors: string[];
  sanitizedSlots: ScheduleSlot[];
} {
  const errors: string[] = [];
  const sanitizedSlots = slots.map((slot) => ({ ...slot }));

  for (const slot of sanitizedSlots) {
    // Strip linkMode from slots with no iterationGroup
    if (infiniteSlotIsLinkable(slot) && !slot.iterationGroup && slot.linkMode) {
      slot.linkMode = undefined;
    }

    // Strip iterationGroup from non-linkable types
    if (!infiniteSlotIsLinkable(slot)) {
      if ('iterationGroup' in slot) {
        delete (slot as Record<string, unknown>)['iterationGroup'];
      }
      if ('linkMode' in slot) {
        delete (slot as Record<string, unknown>)['linkMode'];
      }
    }
  }

  // Group slots by iterationGroup
  const groups = new Map<string, ScheduleSlot[]>();
  for (const slot of sanitizedSlots) {
    if (infiniteSlotIsLinkable(slot) && slot.iterationGroup) {
      const members = groups.get(slot.iterationGroup) ?? [];
      members.push(slot);
      groups.set(slot.iterationGroup, members);
    }
  }

  for (const [groupId, members] of groups) {
    // All slots in a group must have matching content keys
    const contentKeys = new Set(members.map(infiniteSlotContentKey));
    if (contentKeys.size > 1) {
      errors.push(
        `Group ${groupId}: all slots must reference the same content (found ${[...contentKeys].join(', ')})`,
      );
    }

    // All slots in a group must have matching slotConfig.order and direction
    const orders = new Set(
      members.map((m) =>
        infiniteSlotIsLinkable(m) && 'slotConfig' in m
          ? m.slotConfig?.order
          : undefined,
      ),
    );
    if (orders.size > 1) {
      errors.push(
        `Group ${groupId}: all slots must have the same iteration order`,
      );
    }

    const directions = new Set(
      members.map((m) =>
        infiniteSlotIsLinkable(m) && 'slotConfig' in m
          ? m.slotConfig?.direction
          : undefined,
      ),
    );
    if (directions.size > 1) {
      errors.push(
        `Group ${groupId}: all slots must have the same iteration direction`,
      );
    }

    // All slots in a group must have matching linkMode
    const linkModes = new Set(
      members.map((m) =>
        infiniteSlotIsLinkable(m) ? (m.linkMode ?? 'continue') : undefined,
      ),
    );
    if (linkModes.size > 1) {
      errors.push(`Group ${groupId}: all slots must have the same link mode`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedSlots,
  };
}
