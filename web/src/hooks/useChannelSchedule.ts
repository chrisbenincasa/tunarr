import { useSuspenseQuery } from '@tanstack/react-query';
import { getApiChannelsByIdScheduleOptions } from '../generated/@tanstack/react-query.gen.ts';

export const useChannelSchedule = (channelId: string) => {
  return useSuspenseQuery({
    ...getApiChannelsByIdScheduleOptions({
      path: {
        id: channelId,
      },
    }),
  });
};
