import * as TypesApi from '@tunarr/types/api';
import * as TypesSchemas from '@tunarr/types/schemas';
import { describe, expect, test } from 'vitest';
import {
  auditZodContract,
  type ZodContractFinding,
  summarize,
} from './zodContractAudit.ts';

/**
 * Every schema used as a Fastify `body:` or `querystring:` that can be
 * referenced by name. Derived from:
 *
 *   grep -rhE '^\s*(body|querystring):' server/src/api/
 *
 * Routes that declare an inline `z.object({...})` are not covered here; those
 * are visible at their definition site.
 */
const REQUEST_SCHEMA_NAMES = [
  'BasicPagingSchema',
  'BatchLookupExternalProgrammingSchema',
  'CreateChannelRequestSchema',
  'CreateCustomShowRequestSchema',
  'CreateFillerListRequestSchema',
  'CreateStreamSelectionProfileSchema',
  'EmbyLoginRequest',
  'FfmpegSettingsSchema',
  'GlobalMediaSourceSettingsSchema',
  'HdhrSettingsSchema',
  'InsertMediaSourceRequestSchema',
  'JellyfinLoginRequest',
  'PlexStreamSettingsSchema',
  'ProgramSearchRequest',
  'SaveableChannelSchema',
  'SmartCollection',
  'TranscodeConfigSchema',
  'TroubleshootRequestSchema',
  'UpdateBackupSettingsRequestSchema',
  'UpdateChannelProgrammingRequestSchema',
  'UpdateCustomShowRequestSchema',
  'UpdateFeatureFlagsRequestSchema',
  'UpdateFillerListRequestSchema',
  'UpdateMediaSourceLibraryRequest',
  'UpdateMediaSourceRequestSchema',
  'UpdateStreamSelectionProfileSchema',
  'UpdateSystemSettingsRequestSchema',
  'XmlTvSettingsSchema',
] as const;

/**
 * Findings that exist today and are not being changed in this pass. Each one
 * is a decision, not an oversight — remove an entry and the test will tell you
 * if the underlying construct is gone.
 *
 * Format: `SchemaName.path` for each defect-class finding.
 */
const KNOWN: Record<string, string> = {
  // Full-replace body, not a partial update, so the default is the intended
  // value for a field the client leaves out.
  'FfmpegSettingsSchema.transcodeDirectory':
    'PUT /ffmpeg-settings replaces the whole object',

  // Full-replace body. Reviewed as intentional.
  'UpdateChannelProgrammingRequestSchema.lineup.fillerConfig.origin':
    'full-replace lineup body',
  'UpdateChannelProgrammingRequestSchema.schedule.slots.linkMode':
    'full-replace lineup body',
  'UpdateChannelProgrammingRequestSchema.schedule.slots.rerunOverflow':
    'full-replace lineup body',

  // An invalid season filter silently becomes [], which means "no filter" —
  // the same shape as the watermark programType bug. Flagged for the slot
  // scheduling review rather than changed blind.
  'UpdateChannelProgrammingRequestSchema.schedule.slots.seasonFilter':
    'silent widening to no-filter; slot scheduling review',
  'UpdateChannelProgrammingRequestSchema.schedule.slots.seasonExcludeFilter':
    'silent widening to no-filter; slot scheduling review',

  // Reaches the handler as `programs: []`, but saveShow guards on
  // `programs.length > 0`, so it is inert. Means programs cannot be cleared
  // through this route, which is a separate question.
  'UpdateCustomShowRequestSchema.programs':
    'defused by a length guard in CustomShowDB.saveShow',

  // Tracked: xmltv/system settings partial-update fixes.
  'UpdateSystemSettingsRequestSchema.logging.useEnvVarLevel':
    'fixed in the settings partial-update branch',
  'UpdateSystemSettingsRequestSchema.logging.logRollConfig':
    'fixed in the settings partial-update branch',
  'UpdateSystemSettingsRequestSchema.cache.enablePlexRequestCache':
    'catch on a boolean; low impact, not yet changed',
  'XmlTvSettingsSchema.useShowPoster':
    'catch on a boolean; low impact, not yet changed',

  // PUT /system/feature-flags is declared partial but Object.assign's a body
  // that always carries all six flags, so a partial update silently turns the
  // others off.
  'UpdateFeatureFlagsRequestSchema.proxyArtwork': 'feature-flags partial bug',
  'UpdateFeatureFlagsRequestSchema.tonemapEnabled': 'feature-flags partial bug',
  'UpdateFeatureFlagsRequestSchema.webvttSidecarEnabled':
    'feature-flags partial bug',
  'UpdateFeatureFlagsRequestSchema.disableSearchSnapshotInBackup':
    'feature-flags partial bug',
  'UpdateFeatureFlagsRequestSchema.disableVulkan': 'feature-flags partial bug',

  'UpdateFeatureFlagsRequestSchema.disableVaapiPad':
    'feature-flags partial bug',
};

const registry: Record<string, unknown> = {
  ...(TypesApi as Record<string, unknown>),
  ...(TypesSchemas as Record<string, unknown>),
};

function defectsFor(name: string): ZodContractFinding[] {
  const schema = registry[name];
  if (!schema) {
    throw new Error(
      `Request schema "${name}" is no longer exported from @tunarr/types. ` +
        'Update REQUEST_SCHEMA_NAMES.',
    );
  }
  // `coerce` is reported for review, not asserted: it is used deliberately in
  // many query params.
  return auditZodContract(schema).filter((f) => f.kind !== 'coerce');
}

describe('zod request contracts', () => {
  test.each(REQUEST_SCHEMA_NAMES)(
    '%s declares no new contract-breaking constructs',
    (name) => {
      const unexpected = defectsFor(name).filter(
        (f) => !(`${name}.${f.path}` in KNOWN),
      );

      expect(summarize(unexpected)).toEqual({});
    },
  );

  test('every KNOWN entry still corresponds to a real finding', () => {
    const live = new Set(
      REQUEST_SCHEMA_NAMES.flatMap((name) =>
        defectsFor(name).map((f) => `${name}.${f.path}`),
      ),
    );

    const stale = Object.keys(KNOWN).filter((key) => !live.has(key));

    // A stale entry means the construct was fixed. Delete the entry.
    expect(stale).toEqual([]);
  });
});
