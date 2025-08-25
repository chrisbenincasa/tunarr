import { FillerProgram } from '@tunarr/types';
import { BaseSlot } from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { flatten, reduce } from 'lodash-es';
import { CustomShowDB } from '../../db/CustomShowDB.ts';
import { FillerDB } from '../../db/FillerListDB.ts';

@injectable()
export class SlotSchedulerHelper {
  constructor(
    @inject(CustomShowDB) private customShowDB: CustomShowDB,
    @inject(FillerDB) private fillerDB: FillerDB,
  ) {}

  async materializeCustomShowPrograms(slots: BaseSlot[]) {
    // Here's the big one - find shows that are included in the schedule but
    // not currently saved to the channel.
    const slottedCustomShows = reduce(
      slots,
      (acc, curr) => {
        if (curr.type === 'custom-show') {
          acc.add(curr.customShowId);
        }
        return acc;
      },
      new Set<string>(),
    );

    // Query
    return flatten(
      await Promise.all(
        [...slottedCustomShows].map((show) =>
          this.customShowDB.getShowPrograms(show),
        ),
      ),
    );
  }

  async materializeFillerLists(slots: BaseSlot[]) {
    // Here's the big one - find shows that are included in the schedule but
    // not currently saved to the channel.
    const slotFiller = slots.flatMap((slot) => {
      switch (slot.type) {
        case 'filler':
        case 'flex':
        case 'redirect':
          return [];
        case 'movie':
        case 'show':
        case 'custom-show':
          return slot.filler?.map(({ fillerListId }) => fillerListId) ?? [];
      }
    });

    const slottedFillerLists = reduce(
      slots,
      (acc, curr) => {
        if (curr.type === 'filler') {
          acc.add(curr.fillerListId);
        }
        return acc;
      },
      new Set<string>(),
    );

    slotFiller.forEach((id) => slottedFillerLists.add(id));

    // Query
    return flatten(
      await Promise.all(
        [...slottedFillerLists].map((list) =>
          this.fillerDB.getFillerPrograms(list).then((programs) => {
            // Actually make these filler programs -- this is a hack
            return programs.map(
              (program) =>
                ({
                  type: 'filler',
                  duration: program.duration,
                  fillerListId: list,
                  id: program.id,
                  persisted: true,
                  program,
                }) satisfies FillerProgram,
            );
          }),
        ),
      ),
    );
  }
}
