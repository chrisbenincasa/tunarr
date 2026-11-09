import type {
  RandomSlotSchedule,
  ScheduleSkeleton,
  TimeSlotSchedule,
} from '@tunarr/types/api';
import { v4 } from 'uuid';

// Turns a preset's role slots into smart collection slots. Every slot gets a
// fresh ID. A slot naming a role with no collection is an error, because the
// schedule would point at a collection that doesn't exist.
export function resolveScheduleSkeleton(
  skeleton: ScheduleSkeleton,
  collectionIdsByRole: Record<string, string>,
): TimeSlotSchedule | RandomSlotSchedule {
  const collectionIdFor = (role: string) => {
    const id = collectionIdsByRole[role];
    if (id === undefined) {
      throw new Error(`Schedule slot names unknown role "${role}"`);
    }
    return id;
  };

  const toCollectionSlots = <Slot extends { role: string }>(slots: Slot[]) =>
    slots.map(({ role, ...slot }) => ({
      ...slot,
      id: v4(),
      type: 'smart-collection' as const,
      smartCollectionId: collectionIdFor(role),
    }));

  // The branches narrow the union, so each spread keeps its own slot type.
  return skeleton.type === 'time'
    ? { ...skeleton, slots: toCollectionSlots(skeleton.slots) }
    : { ...skeleton, slots: toCollectionSlots(skeleton.slots) };
}
