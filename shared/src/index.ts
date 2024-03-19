export { scheduleRandomSlots } from './services/randomSlotsService.js';
export { scheduleTimeSlots } from './services/timeSlotService.js';
export { mod as dayjsMod } from './util/dayjsExtensions.js';

// TODO replace first arg with shared type
export function createExternalId(
  sourceType: 'plex',
  sourceId: string,
  itemId: string,
): `${string}|${string}|${string}` {
  return `${sourceType}|${sourceId}|${itemId}`;
}
