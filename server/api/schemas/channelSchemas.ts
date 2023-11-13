import z from 'zod';

export const ChannelCreateSchema = {
  body: z.object({
    programs: z.array(
      z.object({
        title: z.string(),
        key: z.string(),
        icon: z.string(),
        type: z.string(),
        duration: z.number(),
        durationStr: z.string(),
        summary: z.string(),
        plexFile: z.string(),
      }),
    ),
  }),
};
