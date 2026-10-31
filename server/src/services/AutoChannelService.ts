import {
  BuiltInPresets,
  getPresetById,
} from '@tunarr/shared/channel-templates';
import { isNonEmptyString, search } from '@tunarr/shared/util';
import type { MediaSourceId } from '@tunarr/shared';
import type { Channel, SaveableChannel } from '@tunarr/types';
import { tag } from '@tunarr/types';
import type {
  AutoChannelCreateRequest,
  ChannelPreset,
  ContentPreviewResponse,
  ContentQuery,
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

    // Filter to terminal programs only (programs with duration, not groupings)
    const terminalResults = results.filter(
      (r): r is TerminalProgramSearchDocument =>
        r.type === 'movie' ||
        r.type === 'episode' ||
        r.type === 'track' ||
        r.type === 'music_video' ||
        r.type === 'other_video',
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
      throw new Error(`Preset not found: ${request.presetId}`);
    }

    const transcodeConfig = await this.transcodeConfigDB.getDefaultConfig();
    if (!transcodeConfig) {
      throw new Error('No default transcode config exists');
    }

    // Step 1: Determine roles — dynamic presets derive roles from contentAssignments
    const roles = preset.dynamicRequirements
      ? Object.keys(request.contentAssignments).map((role) => ({
          role,
          label: role,
          defaultQuery: {} as ContentQuery,
          required: true,
          minPrograms: 0,
        }))
      : preset.contentRequirements;

    // Validate dynamic params match content assignments
    if (request.dynamicParams) {
      const paramRoles =
        request.dynamicParams.type === 'weighted_mix'
          ? request.dynamicParams.groups.map((g) => g.role)
          : request.dynamicParams.blocks.map((b) => b.role);
      const assignmentKeys = Object.keys(request.contentAssignments);
      const missing = paramRoles.filter((r) => !assignmentKeys.includes(r));
      if (missing.length > 0) {
        throw new Error(
          `Missing content assignments for roles: ${missing.join(', ')}`,
        );
      }
    }

    // Step 2: Resolve content for each role and create smart collections
    const smartCollectionIdsByRole: Record<string, string> = {};

    for (const requirement of roles) {
      const assignment = request.contentAssignments[requirement.role];
      const query = assignment?.query ?? requirement.defaultQuery;

      // Create a smart collection for this role
      const collectionName = `${request.channelName ?? preset.name} - ${requirement.label}`;
      const filter = this.buildContentFilter(query);

      const collectionResult = await this.smartCollectionsDB.insert({
        name: collectionName,
        keywords: query.keywords ?? '',
        filter,
        filterString: filter ? search.searchFilterToString(filter) : undefined,
      });

      if (collectionResult.isFailure()) {
        throw new Error(
          `Failed to create smart collection for role ${requirement.role}: ${collectionResult.error.message}`,
        );
      }

      smartCollectionIdsByRole[requirement.role] = collectionResult.get().uuid;
    }

    // Step 3: Build the schedule config
    const scheduleConfig = resolveScheduleSkeleton(
      request.dynamicParams
        ? this.buildScheduleFromDynamicParams(request.dynamicParams)
        : preset.scheduleConfig,
      smartCollectionIdsByRole,
    );

    // Step 4: Resolve program IDs for the schedule
    const allProgramIds: string[] = [];
    for (const requirement of roles) {
      const assignment = request.contentAssignments[requirement.role];

      if (assignment?.programIds?.length) {
        allProgramIds.push(...assignment.programIds);
      } else {
        const collectionId = smartCollectionIdsByRole[requirement.role];
        if (collectionId) {
          const programs =
            await this.smartCollectionsDB.materializeSmartCollection(
              collectionId,
              true,
            );
          allProgramIds.push(...programs.map((p) => p.id));
        }
      }
    }

    // Step 5: Determine the next available channel number
    const channelNumber =
      request.channelNumber ?? (await this.getNextChannelNumber());
    const channelName =
      request.channelName ?? `${preset.name} ${channelNumber}`;

    // Step 6: Create the channel
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
    };

    const savedResult = await this.channelDB.saveChannel(channelData);

    // Step 7: Set the lineup using the schedule
    const channelId = savedResult.channel.uuid;
    const seed = request.seed ? [request.seed] : undefined;

    let lineupRequest: UpdateChannelProgrammingRequest;
    if (scheduleConfig.type === 'time') {
      lineupRequest = {
        type: 'time',
        programs: allProgramIds,
        schedule: scheduleConfig,
        seed,
      };
    } else {
      lineupRequest = {
        type: 'random',
        programs: allProgramIds,
        schedule: scheduleConfig,
        seed,
      };
    }

    await this.channelDB.updateLineup(channelId, lineupRequest);

    // Step 8: Trigger guide regeneration
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

    // Reload and return the created channel with relations
    const channelAndLineup =
      await this.channelDB.loadChannelAndLineupOrm(channelId);
    if (!channelAndLineup) {
      throw new Error('Channel was created but could not be retrieved');
    }

    return dbChannelToApiChannel(channelAndLineup);
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
          padMs: 0,
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
      if (parsed) {
        children.push(
          parsed.type === 'op' ? { ...parsed, grouped: true } : parsed,
        );
      }
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

  private parseFilterString(filterString: string): SearchFilter | undefined {
    const tokenized = search.tokenizeSearchQuery(filterString);
    if (tokenized.errors.length > 0) {
      this.logger.warn('Could not tokenize filter string: %s', filterString);
      return undefined;
    }

    // Use the search parser from shared
    const parser = new search.SearchParser();
    parser.input = tokenized.tokens;
    const clause = parser.searchExpression();
    if (parser.errors.length > 0) {
      this.logger.warn('Could not parse filter string: %s', filterString);
      return undefined;
    }

    return search.parsedSearchToRequest(clause);
  }

  private async getNextChannelNumber(): Promise<number> {
    const channels = await this.channelDB.getAllChannels();
    const usedNumbers = new Set(channels.map((c) => c.number));
    let next = 1;
    while (usedNumbers.has(next)) {
      next++;
    }
    return next;
  }
}
