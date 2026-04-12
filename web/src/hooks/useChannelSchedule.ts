import { useSuspenseQuery } from '@tanstack/react-query';
import { getChannelScheduleOptions } from '../generated/@tanstack/react-query.gen.ts';

export const useChannelSchedule = (channelId: string) => {
  return useSuspenseQuery({
    ...getChannelScheduleOptions({
      path: {
        id: channelId,
      },
    }),
  });
};
