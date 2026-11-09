import {
  BuiltInPresets,
  getPresetById,
} from '@tunarr/shared/channel-templates';
import { isNonEmptyString, search } from '@tunarr/shared/util';
import type { MediaSourceId } from '@tunarr/shared';
import type { Channel, SaveableChannel } from '@tunarr/types';
import { isTerminalItemType, tag } from '@tunarr/types';
import {
  StrictRandomSlotScheduleSchema,
  StrictTimeSlotScheduleSchema,
} from '@tunarr/types/api';
import type {
  AutoChannelCreateRequest,
  ChannelPreset,
  ContentPreviewResponse,
  ContentQuery,
  ContentRequirement,
  DynamicPresetParams,
  ScheduleSkeleton,
  UpdateChannelProgrammingRequest,
} from '@tunarr/types/api';
import type { SearchFilter } from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { countBy, sumBy, take } from 'lodash-es';
import { v4 } from 'uuid';
import { ChannelDB } from '../db/ChannelDB.ts';
import { dbChannelToApiChannel } from '../db/converters/channelConverters.ts';
import { SmartCollectionsDB } from '../db/SmartCollectionsDB.ts';
import { TranscodeConfigDB } from '../db/TranscodeConfigDB.ts';
import { UpdateXmlTvTask } from '../tasks/UpdateXmlTvTask.js';
import { GenericBadRequestError } from '../types/errors.ts';

import type {
  ProgramSearchDocument,
  TerminalProgramSearchDocument,
} from './MeilisearchService.ts';
import { MeilisearchService } from './MeilisearchService.ts';
import { resolveScheduleSkeleton } from './resolveScheduleSkeleton.ts';
import { GlobalScheduler } from './Scheduler.js';

@injectable()
export class AutoChannelService {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(SmartCollectionsDB) private smartCollectionsDB: SmartCollectionsDB,
    @inject(ChannelDB) private channelDB: ChannelDB,
    @inject(TranscodeConfigDB) private transcodeConfigDB: TranscodeConfigDB,
  ) {}

  getPresets(): ChannelPreset[] {
    return BuiltInPresets;
  }

  async previewContent(query: ContentQuery): Promise<ContentPreviewResponse> {
    const results = await this.resolveContentQuery(query);

    const terminalResults = results.filter(
      (r): r is TerminalProgramSearchDocument => isTerminalItemType(r.type),
    );

    const byType: Record<string, number> = {
      movie: 0,
      episode: 0,
      track: 0,
      music_video: 0,
      other_video: 0,
      ...countBy(terminalResults, 'type'),
    };

    // Collect top shows from episodes
    const showCounts: Record<string, number> = {};
    for (const result of terminalResults) {
      if (result.type === 'episode' && result.grandparent?.title) {
        const showName = result.grandparent.title;
        showCounts[showName] = (showCounts[showName] ?? 0) + 1;
      }
    }
    const topShows = Object.entries(showCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, episodeCount]) => ({ name, episodeCount }));

    const totalDurationMs = sumBy(terminalResults, 'duration');

    return {
      totalPrograms: terminalResults.length,
      byType,
      topShows,
      totalDurationMs,
      sampleIds: take(terminalResults, 20).map((r) => r.id),
    };
  }

  async createChannel(request: AutoChannelCreateRequest): Promise<Channel> {
    const preset = getPresetById(request.presetId);
    if (!preset) {
      throw new GenericBadRequestError(`Preset not found: ${request.presetId}`);
    }

    const transcodeConfig = await this.transcodeConfigDB.getDefaultConfig();
    if (!transcodeConfig) {
      throw new Error('No default transcode config exists');
    }

    const roles: ContentRequirement[] = preset.dynamicRequirements
      ? Object.keys(request.contentAssignments).map((role) => ({
          role,
          label: role,
          defaultQuery: {},
          required: true,
          minPrograms: 1,
        }))
      : preset.contentRequirements;

    this.validateAssignments(request, roles, !!preset.dynamicRequirements);
    this.validateRoleUsage(request, preset);

    // Parse every filter before writing, so a bad filter fails cleanly.
    const filtersByRole = Object.fromEntries(
      roles.map((requirement) => [
        requirement.role,
        this.buildContentFilter(
          request.contentAssignments[requirement.role]?.query ??
            requirement.defaultQuery,
        ),
      ]),
    );

    const channelNumber = await this.resolveChannelNumber(
      request.channelNumber,
    );
    const channelName =
      request.channelName ?? `${preset.name} ${channelNumber}`;

    const createdCollectionIds: string[] = [];
    let createdChannelId: string | undefined;

    try {
      const smartCollectionIdsByRole: Record<string, string> = {};
      const allProgramIds: string[] = [];

      for (const requirement of roles) {
        const query =
          request.contentAssignments[requirement.role]?.query ??
          requirement.defaultQuery;
        const filter = filtersByRole[requirement.role];

        const collectionResult = await this.smartCollectionsDB.insert({
          name: `${request.channelName ?? preset.name} - ${requirement.label}`,
          keywords: query.keywords ?? '',
          filter,
          filterString: filter
            ? search.searchFilterToString(filter)
            : undefined,
        });

        if (collectionResult.isFailure()) {
          throw new Error(
            `Failed to create smart collection for role ${requirement.role}: ${collectionResult.error.message}`,
          );
        }

        const collectionId = collectionResult.get().uuid;
        createdCollectionIds.push(collectionId);
        smartCollectionIdsByRole[requirement.role] = collectionId;

        const programIds = (
          await this.smartCollectionsDB.materializeSmartCollection(
            collectionId,
            true,
          )
        ).map((p) => p.id);

        if (programIds.length < requirement.minPrograms) {
          throw new GenericBadRequestError(
            `"${requirement.label}" matches ${programIds.length} programs but needs at least ${requirement.minPrograms}`,
          );
        }

        allProgramIds.push(...programIds);
      }

      const scheduleConfig = resolveScheduleSkeleton(
        request.dynamicParams
          ? this.buildScheduleFromDynamicParams(request.dynamicParams)
          : preset.scheduleConfig,
        smartCollectionIdsByRole,
      );

      // Match the validation the channels API applies to saved schedules.
      const strict =
        scheduleConfig.type === 'time'
          ? StrictTimeSlotScheduleSchema.safeParse(scheduleConfig)
          : StrictRandomSlotScheduleSchema.safeParse(scheduleConfig);
      if (!strict.success) {
        throw new GenericBadRequestError(
          `Invalid schedule: ${strict.error.issues.map((i) => i.message).join('; ')}`,
        );
      }

      const channelData: SaveableChannel = {
        id: v4(),
        name: channelName,
        number: channelNumber,
        duration: 0,
        startTime: Date.now(),
        groupTitle: 'Auto-Created',
        icon: {
          path: '',
          width: 0,
          duration: 0,
          position: 'bottom-right',
        },
        stealth: false,
        disableFillerOverlay: false,
        guideMinimumDuration: 30000,
        offline: {
          mode: 'pic',
          picture: undefined,
          soundtrack: undefined,
        },
        streamMode: 'hls',
        transcodeConfigId: transcodeConfig.uuid,
        subtitlesEnabled: false,
        useEtvNext: false,
      };

      const savedResult = await this.channelDB.saveChannel(channelData);
      createdChannelId = savedResult.channel.uuid;

      const seed = request.seed === undefined ? undefined : [request.seed];
      const lineupRequest: UpdateChannelProgrammingRequest =
        scheduleConfig.type === 'time'
          ? {
              type: 'time',
              programs: allProgramIds,
              schedule: scheduleConfig,
              seed,
            }
          : {
              type: 'random',
              programs: allProgramIds,
              schedule: scheduleConfig,
              seed,
            };

      await this.channelDB.updateLineup(createdChannelId, lineupRequest);
    } catch (err) {
      await this.rollBackCreate(createdChannelId, createdCollectionIds);
      throw err;
    }

    try {
      GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID)
        .runNow(true)
        .catch((err) =>
          this.logger.error(err, 'Error regenerating guide after auto-create'),
        );
    } catch (e) {
      this.logger.error(
        e,
        'Unable to trigger guide update after auto-channel creation',
      );
    }

    const channelAndLineup =
      await this.channelDB.loadChannelAndLineupOrm(createdChannelId);
    if (!channelAndLineup) {
      throw new Error('Channel was created but could not be retrieved');
    }

    return dbChannelToApiChannel(channelAndLineup);
  }

  /**
   * Rejects requests that would schedule a role over the whole library: a
   * required preset role with no assignment, or a picker or dynamic role
   * whose query selects nothing. A role without a picker, such as 24/7
   * Shuffle's, may span the whole library on purpose.
   */
  private validateAssignments(
    request: AutoChannelCreateRequest,
    roles: ContentRequirement[],
    isDynamic: boolean,
  ) {
    if (request.dynamicParams) {
      const paramRoles =
        request.dynamicParams.type === 'weighted_mix'
          ? request.dynamicParams.groups.map((g) => g.role)
          : request.dynamicParams.blocks.map((b) => b.role);
      const missing = paramRoles.filter(
        (r) => !(r in request.contentAssignments),
      );
      if (missing.length > 0) {
        throw new GenericBadRequestError(
          `Missing content assignments for roles: ${missing.join(', ')}`,
        );
      }

      if (request.dynamicParams.type === 'classic_tv_day') {
        const startTimes = request.dynamicParams.blocks.map((b) => b.startTime);
        if (new Set(startTimes).size !== startTimes.length) {
          throw new GenericBadRequestError(
            'Two blocks cannot start at the same time',
          );
        }
      }
    }

    for (const requirement of roles) {
      const assignment = request.contentAssignments[requirement.role];
      if (requirement.required && !assignment) {
        throw new GenericBadRequestError(
          `Missing content assignment for "${requirement.label}"`,
        );
      }
      const query = assignment?.query ?? requirement.defaultQuery;
      const needsFilter = isDynamic || !!requirement.pickerHint;
      if (needsFilter && !selectsContent(query)) {
        throw new GenericBadRequestError(
          `"${requirement.label}" needs a content filter`,
        );
      }
    }
  }

  /**
   * Rejects requests whose roles don't match the preset. Dynamic presets
   * need dynamicParams of their own type, fixed presets take none, and
   * every content assignment must feed a schedule slot.
   */
  private validateRoleUsage(
    request: AutoChannelCreateRequest,
    preset: ChannelPreset,
  ) {
    const { dynamicParams } = request;
    let usedRoles: string[];

    if (preset.dynamicRequirements) {
      const expectedType = dynamicParamsTypeFor(preset);
      if (!dynamicParams) {
        throw new GenericBadRequestError(
          `Preset "${preset.id}" needs dynamicParams of type ${expectedType}`,
        );
      }
      if (dynamicParams.type !== expectedType) {
        throw new GenericBadRequestError(
          `Preset "${preset.id}" needs dynamicParams of type ${expectedType}, not ${dynamicParams.type}`,
        );
      }
      usedRoles =
        dynamicParams.type === 'weighted_mix'
          ? dynamicParams.groups.map((g) => g.role)
          : dynamicParams.blocks.map((b) => b.role);
    } else {
      if (dynamicParams) {
        throw new GenericBadRequestError(
          `Preset "${preset.id}" does not take dynamicParams`,
        );
      }
      usedRoles = preset.contentRequirements.map((req) => req.role);
    }

    const unused = Object.keys(request.contentAssignments).filter(
      (role) => !usedRoles.includes(role),
    );
    if (unused.length > 0) {
      throw new GenericBadRequestError(
        `Preset "${preset.id}" does not use content assignments for roles: ${unused.join(', ')}`,
      );
    }
  }

  private async resolveChannelNumber(requested: number | undefined) {
    const channels = await this.channelDB.getAllChannels();
    const usedNumbers = new Set(channels.map((c) => c.number));

    if (requested !== undefined) {
      if (usedNumbers.has(requested)) {
        throw new GenericBadRequestError(
          `Channel with number ${requested} already exists`,
        );
      }
      return requested;
    }

    let next = 1;
    while (usedNumbers.has(next)) {
      next++;
    }
    return next;
  }

  private async rollBackCreate(
    channelId: string | undefined,
    collectionIds: string[],
  ) {
    try {
      if (channelId) {
        await this.channelDB.deleteChannel(channelId);
      }
      for (const id of collectionIds) {
        await this.smartCollectionsDB.delete(id);
      }
    } catch (e) {
      this.logger.error(e, 'Failed to clean up after auto-channel failure');
    }
  }

  private buildScheduleFromDynamicParams(
    params: DynamicPresetParams,
  ): ScheduleSkeleton {
    switch (params.type) {
      case 'weighted_mix':
        return {
          type: 'random',
          flexPreference: 'end',
          maxDays: 30,
          padMs: 0,
          padStyle: 'episode',
          randomDistribution: 'weighted',
          lockWeights: false,
          slots: params.groups.map((g) => ({
            id: v4(),
            type: 'role' as const,
            role: g.role,
            order: 'shuffle' as const,
            direction: 'asc' as const,
            cooldownMs: 0,
            weight: g.weight,
            durationSpec: { type: 'dynamic' as const, programCount: 1 },
          })),
        };
      case 'classic_tv_day':
        return {
          type: 'time',
          flexPreference: 'end',
          period: 'day',
          maxDays: 30,

          // The time slot scheduler pads with a modulo, so zero is invalid.
          // One millisecond means no padding.
          padMs: 1,
          latenessMs: 900000, // 15 minutes
          overflow: { type: 'duration', maxMs: 0 },
          timeZoneOffset: 0,
          slots: params.blocks.map((b) => ({
            id: v4(),
            type: 'role' as const,
            role: b.role,
            startTime: b.startTime,
            order: 'shuffle' as const,
            direction: 'asc' as const,
          })),
        };
    }
  }

  private async resolveContentQuery(
    query: ContentQuery,
  ): Promise<ProgramSearchDocument[]> {
    const searchFilter = this.buildContentFilter(query);

    // Paginate through all results
    const results: ProgramSearchDocument[] = [];
    let page = query.keywords ? 1 : 0;

    for (;;) {
      const pageResult = await this.searchService.search('programs', {
        paging: { page, limit: 100 },
        query: query.keywords ?? null,
        filter: searchFilter ?? null,
      });

      if (pageResult.results.length === 0) {
        break;
      }

      results.push(...pageResult.results);
      page++;

      // Safety limit to prevent runaway queries
      if (results.length >= 10000) {
        break;
      }
    }

    return results;
  }

  /**
   * Builds the role's full filter as one tree. The search service
   * parenthesizes nested groups, so an OR inside the user's filter
   * cannot escape the scope clauses.
   */
  private buildContentFilter(query: ContentQuery): SearchFilter | undefined {
    const children: SearchFilter[] = [];

    if (isNonEmptyString(query.filterString)) {
      const parsed = this.parseFilterString(query.filterString);
      children.push(
        parsed.type === 'op' ? { ...parsed, grouped: true } : parsed,
      );
    }

    if (isNonEmptyString(query.groupingId)) {
      children.push({
        type: 'value',
        fieldSpec: {
          key: 'grandparent.id',
          name: 'Show',
          op: '=',
          type: 'string',
          value: [query.groupingId],
        },
      });
    }

    if (query.programTypes?.length) {
      children.push({
        type: 'value',
        fieldSpec: {
          key: 'type',
          name: 'Type',
          op: 'in',
          type: 'string',
          value: query.programTypes,
        },
      });
    }

    const anyOf = (filters: SearchFilter[]): SearchFilter | undefined => {
      if (filters.length <= 1) {
        return filters[0];
      }
      return { type: 'op', op: 'or', children: filters, grouped: true };
    };

    const mediaSourceFilter = anyOf(
      (query.mediaSourceIds ?? []).map((id) =>
        search.makeMediaSourceIdFilter(tag<MediaSourceId>(id)),
      ),
    );
    if (mediaSourceFilter) {
      children.push(mediaSourceFilter);
    }

    const libraryFilter = anyOf(
      (query.libraryIds ?? []).map((id) => search.makeLibraryIdFilter(id)),
    );
    if (libraryFilter) {
      children.push(libraryFilter);
    }

    if (children.length <= 1) {
      return children[0];
    }
    return { type: 'op', op: 'and', children };
  }

  private parseFilterString(filterString: string): SearchFilter {
    const tokenized = search.tokenizeSearchQuery(filterString);
    if (tokenized.errors.length > 0) {
      throw new GenericBadRequestError(
        `Could not parse filter: ${filterString}`,
      );
    }

    const parser = new search.SearchParser();
    parser.input = tokenized.tokens;
    const clause = parser.searchExpression();
    if (parser.errors.length > 0) {
      throw new GenericBadRequestError(
        `Could not parse filter: ${filterString}`,
      );
    }

    return search.parsedSearchToRequest(clause);
  }
}

/**
 * Mirrors the wizard, which builds a weighted mix when the preset's first
 * role has a weighted_mix picker and a Classic TV Day otherwise.
 */
function dynamicParamsTypeFor(
  preset: ChannelPreset,
): DynamicPresetParams['type'] {
  return preset.contentRequirements[0]?.pickerHint?.type === 'weighted_mix'
    ? 'weighted_mix'
    : 'classic_tv_day';
}

function selectsContent(query: ContentQuery): boolean {
  return (
    isNonEmptyString(query.filterString) ||
    isNonEmptyString(query.keywords) ||
    isNonEmptyString(query.groupingId) ||
    !!query.mediaSourceIds?.length ||
    !!query.libraryIds?.length ||
    !!query.programTypes?.length
  );
}
