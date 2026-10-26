import type { ChannelPreset } from '@tunarr/types/api';
import { isEmpty } from 'lodash-es';
import { z } from 'zod/v4';
import type { TimeBlock } from './BlockConfigurator.tsx';
import type { WeightedGroup } from './DynamicRoleManager.tsx';
import type { RoleSelection } from './roleQuery.ts';

export const ChannelTemplateFormatVersion = 1;

const DayMs = 24 * 60 * 60 * 1000;

// A template keeps what the user picked and drops anything tied to this
// server, such as media sources, libraries, and shows.
const TemplateRoleSchema = z.object({
  facetField: z.string().optional(),
  facetValues: z.string().array().optional(),
  yearRange: z.object({ start: z.int(), end: z.int() }).optional(),
  pickerFilter: z.string().optional(),
  advancedFilter: z.string().optional(),
});

export const ChannelTemplateSchema = z.object({
  formatVersion: z.literal(ChannelTemplateFormatVersion),
  presetId: z.string(),
  channelName: z.string().optional(),
  weightedGroups: z
    .array(
      z.object({
        role: z.string(),
        label: z.string(),
        weight: z.int().min(1).max(10),
      }),
    )
    .optional(),
  timeBlocks: z
    .array(
      z.object({
        role: z.string(),
        label: z.string(),
        startTime: z
          .int()
          .min(0)
          .max(DayMs - 1),
      }),
    )
    .optional(),
  roles: z.record(z.string(), TemplateRoleSchema),
});

export type ChannelTemplate = z.infer<typeof ChannelTemplateSchema>;

export type DynamicKind = 'weighted_mix' | 'classic_tv';

export function dynamicKind(preset: ChannelPreset): DynamicKind | undefined {
  if (!preset.dynamicRequirements) {
    return undefined;
  }
  const hint = preset.contentRequirements[0]?.pickerHint?.type;
  return hint === 'weighted_mix' || hint === 'classic_tv' ? hint : undefined;
}

export function blockLimits(preset: ChannelPreset): {
  min: number;
  max: number;
} {
  return {
    min: preset.minBlocks ?? 2,
    max: preset.maxBlocks ?? (dynamicKind(preset) === 'classic_tv' ? 8 : 10),
  };
}

// A binge channel names one show by its ID on this server, so it can't be
// shared until templates match shows by external ID.
export function canExportPreset(preset: ChannelPreset): boolean {
  return preset.contentRequirements.every(
    (req) => req.pickerHint?.type !== 'single-show',
  );
}

export type WizardTemplateState = {
  preset: ChannelPreset;
  channelName: string;
  weightedGroups: WeightedGroup[];
  timeBlocks: TimeBlock[];
  roleSelections: Record<string, RoleSelection>;
};

export function toChannelTemplate(
  state: WizardTemplateState,
  roles: string[],
): ChannelTemplate {
  const kind = dynamicKind(state.preset);

  const templateRoles: ChannelTemplate['roles'] = {};
  for (const role of roles) {
    const selection = state.roleSelections[role];
    if (selection === undefined) {
      continue;
    }
    templateRoles[role] = {
      facetField: selection.facetField,
      facetValues: isEmpty(selection.facetValues)
        ? undefined
        : selection.facetValues,
      yearRange: selection.yearRange,
      pickerFilter: emptyToUndefined(selection.pickerFilter),
      advancedFilter: emptyToUndefined(selection.advancedFilter),
    };
  }

  return {
    formatVersion: ChannelTemplateFormatVersion,
    presetId: state.preset.id,
    channelName: emptyToUndefined(state.channelName.trim()),
    weightedGroups: kind === 'weighted_mix' ? state.weightedGroups : undefined,
    timeBlocks: kind === 'classic_tv' ? state.timeBlocks : undefined,
    roles: templateRoles,
  };
}

export type ParsedTemplate =
  | { ok: true; state: WizardTemplateState }
  | { ok: false; error: string };

export function parseChannelTemplate(
  text: string,
  presets: ChannelPreset[],
): ParsedTemplate {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON." };
  }

  const version = z.object({ formatVersion: z.number() }).safeParse(json);
  if (!version.success) {
    return { ok: false, error: "This file isn't a Tunarr channel template." };
  }
  if (version.data.formatVersion > ChannelTemplateFormatVersion) {
    return {
      ok: false,
      error:
        'This template was made by a newer version of Tunarr. Update Tunarr to import it.',
    };
  }

  const parsed = ChannelTemplateSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: `This template is malformed. ${z.prettifyError(parsed.error)}`,
    };
  }
  const template = parsed.data;

  const preset = presets.find((p) => p.id === template.presetId);
  if (preset === undefined) {
    return {
      ok: false,
      error: `This template uses the "${template.presetId}" style, which this version of Tunarr doesn't have.`,
    };
  }
  if (!canExportPreset(preset)) {
    return {
      ok: false,
      error: `${preset.name} templates aren't supported yet.`,
    };
  }

  const kind = dynamicKind(preset);
  const weightedGroups =
    kind === 'weighted_mix' ? (template.weightedGroups ?? []) : [];
  const timeBlocks = kind === 'classic_tv' ? (template.timeBlocks ?? []) : [];

  let roles: string[];
  if (kind === undefined) {
    roles = preset.contentRequirements.map((req) => req.role);
  } else {
    const blocks = kind === 'weighted_mix' ? weightedGroups : timeBlocks;
    const { min, max } = blockLimits(preset);
    if (blocks.length < min || blocks.length > max) {
      return {
        ok: false,
        error: `${preset.name} needs between ${min} and ${max} blocks, but this template has ${blocks.length}.`,
      };
    }
    roles = blocks.map((b) => b.role);
    if (new Set(roles).size !== roles.length) {
      return { ok: false, error: 'This template repeats a block name.' };
    }
  }

  const unknownRole = Object.keys(template.roles).find(
    (role) => !roles.includes(role),
  );
  if (unknownRole !== undefined) {
    return {
      ok: false,
      error: `This template sets content for "${unknownRole}", which ${preset.name} doesn't have.`,
    };
  }

  return {
    ok: true,
    state: {
      preset,
      channelName: template.channelName ?? '',
      weightedGroups,
      timeBlocks,
      roleSelections: template.roles,
    },
  };
}

export function templateFileName(template: ChannelTemplate): string {
  const base = (template.channelName ?? template.presetId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${isEmpty(base) ? 'channel' : base}.tunarr-template.json`;
}

function emptyToUndefined(s: string | undefined): string | undefined {
  return isEmpty(s) ? undefined : s;
}
