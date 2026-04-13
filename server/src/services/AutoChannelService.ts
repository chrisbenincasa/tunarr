import {
  BuiltInPresets,
  getPresetById,
} from '@tunarr/shared/channel-templates';
import { isNonEmptyString, search } from '@tunarr/shared/util';
import type { Channel, SaveableChannel } from '@tunarr/types';
import type {
  AutoChannelCreateRequest,
  ChannelPreset,
  ContentPreviewResponse,
  ContentQuery,
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
import { UpdateXmlTvTask } from '../tasks/UpdateXmlTvTask.js';

import type {
  ProgramSearchDocument,
  TerminalProgramSearchDocument,
} from './MeilisearchService.ts';
import { MeilisearchService } from './MeilisearchService.ts';
import { GlobalScheduler } from './Scheduler.js';

@injectable()
export class AutoChannelService {
  @InjectLogger() private declare readonly logger: Logger;

  constructor(
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(SmartCollectionsDB) private smartCollectionsDB: SmartCollectionsDB,
    @inject(ChannelDB) private channelDB: ChannelDB,
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

    // Step 1: Resolve content for each role and create smart collections
    const smartCollectionIdsByRole: Record<string, string> = {};

    for (const requirement of preset.contentRequirements) {
      const assignment = request.contentAssignments[requirement.role];
      const query = assignment?.query ?? requirement.defaultQuery;

      // Create a smart collection for this role
      const collectionName = `${request.channelName ?? preset.name} - ${requirement.label}`;
      const filterString = this.contentQueryToFilterString(query);

      const collectionResult = await this.smartCollectionsDB.insert({
        name: collectionName,
        keywords: query.keywords ?? '',
        filter: filterString ? this.parseFilterString(filterString) : undefined,
        filterString,
      });

      if (collectionResult.isFailure()) {
        throw new Error(
          `Failed to create smart collection for role ${requirement.role}: ${collectionResult.error.message}`,
        );
      }

      smartCollectionIdsByRole[requirement.role] = collectionResult.get().uuid;
    }

    // Step 2: Build the schedule config with resolved smart collection IDs
    const scheduleConfig = structuredClone(preset.scheduleConfig);

    // Assign fresh IDs and replace placeholder smart collection IDs in slots
    for (const slot of 'slots' in scheduleConfig ? scheduleConfig.slots : []) {
      if ('id' in slot) {
        slot.id = v4();
      }
      if (slot.type === 'smart-collection' && !slot.smartCollectionId) {
        // Assign the first role's smart collection as default
        const firstRole = preset.contentRequirements[0];
        if (firstRole) {
          slot.smartCollectionId =
            smartCollectionIdsByRole[firstRole.role] ?? '';
        }
      } else if (
        slot.type === 'smart-collection' &&
        slot.smartCollectionId in smartCollectionIdsByRole
      ) {
        slot.smartCollectionId =
          smartCollectionIdsByRole[slot.smartCollectionId]!;
      }
    }

    // Step 3: Resolve program IDs for the schedule
    const allProgramIds: string[] = [];
    for (const requirement of preset.contentRequirements) {
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

    // Step 4: Determine the next available channel number
    const channelNumber =
      request.channelNumber ?? (await this.getNextChannelNumber());
    const channelName =
      request.channelName ?? `${preset.name} ${channelNumber}`;

    // Step 5: Create the channel
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
      transcodeConfigId: 'default',
      subtitlesEnabled: false,
    };

    const savedResult = await this.channelDB.saveChannel(channelData);

    // Step 6: Set the lineup using the schedule
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

    // Step 7: Trigger guide regeneration
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

  private async resolveContentQuery(
    query: ContentQuery,
  ): Promise<ProgramSearchDocument[]> {
    let searchFilter: SearchFilter | undefined;

    if (isNonEmptyString(query.filterString)) {
      searchFilter = this.parseFilterString(query.filterString);
    }

    // Build type filter if programTypes specified
    if (query.programTypes?.length) {
      const typeFilter: SearchFilter = {
        type: 'value',
        fieldSpec: {
          key: 'type',
          name: 'Type',
          op: 'in',
          type: 'string',
          value: query.programTypes,
        },
      };

      if (searchFilter) {
        searchFilter = {
          type: 'op',
          op: 'and',
          children: [searchFilter, typeFilter],
        };
      } else {
        searchFilter = typeFilter;
      }
    }

    // Paginate through all results
    const results: ProgramSearchDocument[] = [];
    let page = query.keywords ? 1 : 0;

    for (;;) {
      const pageResult = await this.searchService.search('programs', {
        paging: { page, limit: 100 },
        query: query.keywords ?? null,
        filter: searchFilter ?? null,
        libraryId: query.libraryIds?.[0],
        mediaSourceId: query.mediaSourceIds?.[0],
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

  private contentQueryToFilterString(query: ContentQuery): string | undefined {
    const parts: string[] = [];

    if (isNonEmptyString(query.filterString)) {
      parts.push(query.filterString);
    }

    if (query.programTypes?.length) {
      const types = query.programTypes.map((t) => `"${t}"`).join(', ');
      parts.push(`type in (${types})`);
    }

    return parts.length > 0 ? parts.join(' AND ') : undefined;
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
