import type { RouterPluginCallback } from '@/types/serverType.js';
import {
  CreateStreamSelectionProfileSchema,
  StreamSelectionProfileSchema,
  UpdateStreamSelectionProfileSchema,
} from '@tunarr/types/schemas';
import { count, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod/v4';
import { Channel } from '../db/schema/Channel.ts';
import { FillerShow } from '../db/schema/FillerShow.ts';
import { Program } from '../db/schema/Program.ts';
import { StreamSelectionProfile } from '../db/schema/StreamSelectionProfile.ts';
import { CelEvaluationService } from '../services/CelEvaluationService.ts';

export const streamSelectionRouter: RouterPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  // List all profiles
  fastify.get(
    '/stream-selection-profiles',
    {
      schema: {
        tags: ['Stream Selection'],
        response: {
          200: z.array(
            StreamSelectionProfileSchema.extend({
              usedByChannels: z.number(),
              usedByFillers: z.number(),
              usedByPrograms: z.number(),
            }),
          ),
        },
      },
    },
    async (req, res) => {
      const drizzle = req.serverCtx.drizzleFactory();
      const profiles = await drizzle.select().from(StreamSelectionProfile);

      const results = await Promise.all(
        profiles.map(async (profile) => {
          const channelResult = await drizzle
            .select({ value: count() })
            .from(Channel)
            .where(eq(Channel.streamSelectionProfileId, profile.uuid));

          const fillerResult = await drizzle
            .select({ value: count() })
            .from(FillerShow)
            .where(eq(FillerShow.streamSelectionProfileId, profile.uuid));

          const programResult = await drizzle
            .select({ value: count() })
            .from(Program)
            .where(eq(Program.streamSelectionProfileId, profile.uuid));

          return {
            ...profile,
            usedByChannels: channelResult[0]?.value ?? 0,
            usedByFillers: fillerResult[0]?.value ?? 0,
            usedByPrograms: programResult[0]?.value ?? 0,
          };
        }),
      );

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

      // FK on_delete: 'set null' handles clearing references automatically
      await drizzle
        .delete(StreamSelectionProfile)
        .where(eq(StreamSelectionProfile.uuid, req.params.id));

      return res.send();
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
