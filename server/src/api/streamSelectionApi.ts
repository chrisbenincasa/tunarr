import type { RouterPluginCallback } from '@/types/serverType.js';
import {
  BuiltInStreamSelectionProfileId,
  CreateStreamSelectionProfileSchema,
  StreamSelectionProfileSchema,
  StreamSelectionProfileWithUsageSchema,
  StreamSelectionSettingsSchema,
  UpdateStreamSelectionProfileSchema,
} from '@tunarr/types/schemas';
import { count, eq, isNotNull } from 'drizzle-orm';
import { groupBy, orderBy } from 'lodash-es';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod/v4';
import { Channel } from '../db/schema/Channel.ts';
import { CustomShow } from '../db/schema/CustomShow.ts';
import { FillerShow } from '../db/schema/FillerShow.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import { Program } from '../db/schema/Program.ts';
import { StreamSelectionProfile } from '../db/schema/StreamSelectionProfile.ts';
import { CelEvaluationService } from '../services/CelEvaluationService.ts';

const ErrorResponseSchema = z.object({ message: z.string() });

/**
 * Checks a stream selection profile assignment from a save request. Returns
 * an error message if the profile does not exist. `null` (clear) and
 * `undefined` (leave unchanged) are always valid.
 */
export async function validateStreamSelectionProfileId(
  drizzle: DrizzleDBAccess,
  profileId: string | null | undefined,
): Promise<string | undefined> {
  if (profileId === null || profileId === undefined) {
    return;
  }
  const [profile] = await drizzle
    .select({ uuid: StreamSelectionProfile.uuid })
    .from(StreamSelectionProfile)
    .where(eq(StreamSelectionProfile.uuid, profileId))
    .limit(1);
  return profile
    ? undefined
    : `Stream selection profile with ID ${profileId} not found`;
}

export const streamSelectionRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  // List all profiles, with where each one is used
  fastify.get(
    '/stream-selection-profiles',
    {
      schema: {
        tags: ['Stream Selection'],
        response: {
          200: z.array(StreamSelectionProfileWithUsageSchema),
        },
      },
    },
    async (req, res) => {
      const drizzle = req.serverCtx.drizzleFactory();
      const profiles = await drizzle.select().from(StreamSelectionProfile);

      const [channels, fillerLists, customShows, programCounts] =
        await Promise.all([
          drizzle
            .select({
              uuid: Channel.uuid,
              name: Channel.name,
              number: Channel.number,
              profileId: Channel.streamSelectionProfileId,
            })
            .from(Channel)
            .where(isNotNull(Channel.streamSelectionProfileId)),
          drizzle
            .select({
              uuid: FillerShow.uuid,
              name: FillerShow.name,
              profileId: FillerShow.streamSelectionProfileId,
            })
            .from(FillerShow)
            .where(isNotNull(FillerShow.streamSelectionProfileId)),
          drizzle
            .select({
              uuid: CustomShow.uuid,
              name: CustomShow.name,
              profileId: CustomShow.streamSelectionProfileId,
            })
            .from(CustomShow)
            .where(isNotNull(CustomShow.streamSelectionProfileId)),
          drizzle
            .select({
              profileId: Program.streamSelectionProfileId,
              value: count(),
            })
            .from(Program)
            .where(isNotNull(Program.streamSelectionProfileId))
            .groupBy(Program.streamSelectionProfileId),
        ]);

      const channelsByProfile = groupBy(
        orderBy(channels, (c) => c.number),
        (c) => c.profileId,
      );
      const fillersByProfile = groupBy(fillerLists, (f) => f.profileId);
      const customShowsByProfile = groupBy(customShows, (c) => c.profileId);
      const defaultProfileId =
        req.serverCtx.settings.streamSelectionSettings().defaultProfileId;

      const results = orderBy(profiles, [
        (p) => !p.locked,
        (p) => p.name.toLowerCase(),
      ]).map((profile) => ({
        ...profile,
        isDefault: profile.uuid === defaultProfileId,
        usage: {
          channels: (channelsByProfile[profile.uuid] ?? []).map(
            ({ uuid, name, number }) => ({ uuid, name, number }),
          ),
          fillerLists: (fillersByProfile[profile.uuid] ?? []).map(
            ({ uuid, name }) => ({ uuid, name }),
          ),
          customShows: (customShowsByProfile[profile.uuid] ?? []).map(
            ({ uuid, name }) => ({ uuid, name }),
          ),
          programCount:
            programCounts.find((p) => p.profileId === profile.uuid)?.value ?? 0,
        },
      }));

      return res.send(results);
    },
  );

  // Get profile by ID
  fastify.get(
    '/stream-selection-profiles/:id',
    {
      schema: {
        tags: ['Stream Selection'],
        params: z.object({ id: z.string() }),
        response: {
          200: StreamSelectionProfileSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const drizzle = req.serverCtx.drizzleFactory();
      const [profile] = await drizzle
        .select()
        .from(StreamSelectionProfile)
        .where(eq(StreamSelectionProfile.uuid, req.params.id))
        .limit(1);

      if (!profile) {
        return res.status(404).send();
      }

      return res.send(profile);
    },
  );

  // Create profile
  fastify.post(
    '/stream-selection-profiles',
    {
      schema: {
        tags: ['Stream Selection'],
        body: CreateStreamSelectionProfileSchema,
        response: {
          201: StreamSelectionProfileSchema,
        },
      },
    },
    async (req, res) => {
      const drizzle = req.serverCtx.drizzleFactory();
      const uuid = uuidv4();
      const now = new Date();

      await drizzle.insert(StreamSelectionProfile).values({
        uuid,
        name: req.body.name,
        rules: req.body.rules,
        createdAt: now,
        updatedAt: now,
      });

      const [profile] = await drizzle
        .select()
        .from(StreamSelectionProfile)
        .where(eq(StreamSelectionProfile.uuid, uuid))
        .limit(1);

      return res.status(201).send(profile);
    },
  );

  // Update profile
  fastify.put(
    '/stream-selection-profiles/:id',
    {
      schema: {
        tags: ['Stream Selection'],
        params: z.object({ id: z.string() }),
        body: UpdateStreamSelectionProfileSchema,
        response: {
          200: StreamSelectionProfileSchema,
          403: ErrorResponseSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const drizzle = req.serverCtx.drizzleFactory();
      const [existing] = await drizzle
        .select()
        .from(StreamSelectionProfile)
        .where(eq(StreamSelectionProfile.uuid, req.params.id))
        .limit(1);

      if (!existing) {
        return res.status(404).send();
      }

      if (existing.locked) {
        return res
          .status(403)
          .send({ message: 'Built-in profiles cannot be edited' });
      }

      await drizzle
        .update(StreamSelectionProfile)
        .set({
          name: req.body.name,
          rules: req.body.rules,
          updatedAt: new Date(),
        })
        .where(eq(StreamSelectionProfile.uuid, req.params.id));

      const [updated] = await drizzle
        .select()
        .from(StreamSelectionProfile)
        .where(eq(StreamSelectionProfile.uuid, req.params.id))
        .limit(1);

      return res.send(updated);
    },
  );

  // Delete profile
  fastify.delete(
    '/stream-selection-profiles/:id',
    {
      schema: {
        tags: ['Stream Selection'],
        params: z.object({ id: z.string() }),
        response: {
          200: z.void(),
          403: ErrorResponseSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const drizzle = req.serverCtx.drizzleFactory();
      const id = req.params.id;
      const [existing] = await drizzle
        .select()
        .from(StreamSelectionProfile)
        .where(eq(StreamSelectionProfile.uuid, id))
        .limit(1);

      if (!existing) {
        return res.status(404).send();
      }

      if (existing.locked) {
        return res
          .status(403)
          .send({ message: 'Built-in profiles cannot be deleted' });
      }

      // The foreign keys were created without ON DELETE SET NULL, so clear
      // references before deleting. Anything that used this profile falls
      // through to the next level of the resolution chain.
      drizzle.transaction((tx) => {
        tx.update(Channel)
          .set({ streamSelectionProfileId: null })
          .where(eq(Channel.streamSelectionProfileId, id))
          .run();
        tx.update(FillerShow)
          .set({ streamSelectionProfileId: null })
          .where(eq(FillerShow.streamSelectionProfileId, id))
          .run();
        tx.update(CustomShow)
          .set({ streamSelectionProfileId: null })
          .where(eq(CustomShow.streamSelectionProfileId, id))
          .run();
        tx.update(Program)
          .set({ streamSelectionProfileId: null })
          .where(eq(Program.streamSelectionProfileId, id))
          .run();
        tx.delete(StreamSelectionProfile)
          .where(eq(StreamSelectionProfile.uuid, id))
          .run();
      });

      const settings = req.serverCtx.settings;
      if (settings.streamSelectionSettings().defaultProfileId === id) {
        await settings.updateSettings('streamSelection', {
          defaultProfileId: BuiltInStreamSelectionProfileId,
        });
      }

      return res.send();
    },
  );

  fastify.get(
    '/stream-selection-settings',
    {
      schema: {
        tags: ['Stream Selection'],
        response: {
          200: StreamSelectionSettingsSchema,
        },
      },
    },
    async (req, res) => {
      return res.send(req.serverCtx.settings.streamSelectionSettings());
    },
  );

  fastify.put(
    '/stream-selection-settings',
    {
      schema: {
        tags: ['Stream Selection'],
        body: StreamSelectionSettingsSchema,
        response: {
          200: StreamSelectionSettingsSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (req, res) => {
      const drizzle = req.serverCtx.drizzleFactory();
      const [profile] = await drizzle
        .select({ uuid: StreamSelectionProfile.uuid })
        .from(StreamSelectionProfile)
        .where(eq(StreamSelectionProfile.uuid, req.body.defaultProfileId))
        .limit(1);

      if (!profile) {
        return res.status(400).send({
          message: `Stream selection profile ${req.body.defaultProfileId} does not exist`,
        });
      }

      await req.serverCtx.settings.updateSettings('streamSelection', req.body);
      return res.send(req.serverCtx.settings.streamSelectionSettings());
    },
  );

  // Validate CEL expression
  fastify.post(
    '/stream-selection-profiles/validate-expression',
    {
      schema: {
        tags: ['Stream Selection'],
        body: z.object({ expression: z.string() }),
        response: {
          200: z.object({
            valid: z.literal(true),
          }),
          400: z.object({
            valid: z.literal(false),
            error: z.string().optional(),
          }),
        },
      },
    },
    async (req, res) => {
      const celService = new CelEvaluationService();
      const error = celService.validate(req.body.expression);
      if (error) {
        return res
          .status(error.httpCode)
          .send({ valid: false, error: error.message });
      }
      return res.send({ valid: true });
    },
  );

  done();
};
