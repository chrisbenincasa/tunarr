// Generated from schema/lineup_config.json by scripts/generate-etv-schemas.ts.
// Do not edit. Refinements belong in the hand-written files one level up.

import { z } from 'zod/v4';

export const ChannelConfigSchema = z.strictObject({
  config: z.string(),
  group: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  name: z.string(),
  number: z.string(),
  overlays: z.array(z.string()).optional(),
  tvg_id: z.string().nullable().optional(),
});
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

export const OutputConfigSchema = z.strictObject({
  folder: z.string(),
});
export type OutputConfig = z.infer<typeof OutputConfigSchema>;

export const ServerConfigSchema = z.strictObject({
  bind_address: z.string().optional(),
  port: z.number().int().min(0).max(65535).optional(),
});
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export const XmltvConfigSchema = z.strictObject({
  folder: z.string(),
});
export type XmltvConfig = z.infer<typeof XmltvConfigSchema>;

export const LineupConfigSchema = z.strictObject({
  channels: z.array(ChannelConfigSchema),
  output: OutputConfigSchema,
  server: ServerConfigSchema.optional(),
  xmltv: XmltvConfigSchema.nullable().optional(),
});
export type LineupConfig = z.infer<typeof LineupConfigSchema>;
