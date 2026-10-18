import { AdvancedFilterSection } from '@/components/auto-channel/AdvancedFilterSection';
import { ContentPreview } from '@/components/auto-channel/ContentPreview';
import {
  BlockConfigurator,
  type TimeBlock,
} from '@/components/auto-channel/BlockConfigurator';
import {
  DynamicRoleManager,
  type WeightedGroup,
} from '@/components/auto-channel/DynamicRoleManager';
import {
  GlobalContentControls,
  type GlobalContentContext,
} from '@/components/auto-channel/GlobalContentControls';
import { PresetCard } from '@/components/auto-channel/PresetCard';
import { FacetPicker } from '@/components/auto-channel/content-pickers/FacetPicker';
import { SingleShowPicker } from '@/components/auto-channel/content-pickers/SingleShowPicker';
import { YearRangePicker } from '@/components/auto-channel/content-pickers/YearRangePicker';
import PaddedPaper from '@/components/base/PaddedPaper';
import { getApiMediaSourcesOptions } from '@/generated/@tanstack/react-query.gen';
import {
  useAutoChannelPresets,
  useAutoCreateChannel,
  usePreviewContent,
} from '@/hooks/useAutoChannel';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type {
  AutoChannelCreateRequest,
  ChannelPreset,
  ContentAssignment,
  ContentPreviewResponse,
  ContentQuery,
  ContentRequirement,
  DynamicPresetParams,
} from '@tunarr/types/api';
import { useCallback, useEffect, useState } from 'react';

const steps = ['Choose Style', 'Select Content', 'Review & Create'];

export function AutoCreateWizard() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<ChannelPreset | null>(
    null,
  );
  const [contentAssignments, setContentAssignments] = useState<
    Record<string, ContentAssignment>
  >({});
  const [previews, setPreviews] = useState<
    Record<string, ContentPreviewResponse>
  >({});
  const [channelName, setChannelName] = useState('');
  const [channelNumber, setChannelNumber] = useState<number | undefined>();
  const [globalContext, setGlobalContext] = useState<GlobalContentContext>({});
  const [dynamicRoles, setDynamicRoles] = useState<ContentRequirement[]>([]);
  const [weightedGroups, setWeightedGroups] = useState<WeightedGroup[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [dynamicParams, setDynamicParams] = useState<
    DynamicPresetParams | undefined
  >();

  const { data: mediaSources, isLoading: mediaSourcesLoading } = useQuery(
    getApiMediaSourcesOptions(),
  );
  const { data: presets, isLoading: presetsLoading } = useAutoChannelPresets();
  const previewMutation = usePreviewContent();
  const createMutation = useAutoCreateChannel();

  // Load preview when preset is selected
  useEffect(() => {
    if (!selectedPreset) return;

    for (const req of selectedPreset.contentRequirements) {
      const query: ContentQuery =
        contentAssignments[req.role]?.query ?? req.defaultQuery;
      previewMutation.mutate(query, {
        onSuccess: (data) => {
          setPreviews((prev) => ({ ...prev, [req.role]: data }));
        },
      });
    }
    // Only run when preset changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset?.id]);

  const handleContentChange = useCallback(
    (role: string, query: ContentQuery) => {
      setContentAssignments((prev) => ({
        ...prev,
        [role]: { query },
      }));
      // Trigger preview for this role
      previewMutation.mutate(query, {
        onSuccess: (data) => {
          setPreviews((prev) => ({ ...prev, [role]: data }));
        },
      });
    },
    [previewMutation],
  );

  const handlePresetSelect = useCallback((preset: ChannelPreset) => {
    setSelectedPreset(preset);
    setChannelName('');
    setChannelNumber(undefined);
    setContentAssignments({});
    setPreviews({});
    setGlobalContext({});

    // Initialize dynamic roles for dynamic presets
    if (preset.dynamicRequirements) {
      const blockCount =
        preset.defaultBlocks ?? preset.contentRequirements.length;
      const isWeightedMix =
        preset.contentRequirements[0]?.pickerHint?.type === 'weighted_mix';

      if (isWeightedMix) {
        const groups: WeightedGroup[] = Array.from(
          { length: blockCount },
          (_, i) => ({
            role: `group_${i + 1}`,
            label: `Group ${i + 1}`,
            weight: 1,
          }),
        );
        setWeightedGroups(groups);
        setTimeBlocks([]);
        setDynamicRoles(
          groups.map((g) => ({
            role: g.role,
            label: g.label,
            defaultQuery: {},
            required: true,
            minPrograms: 1,
          })),
        );
        setDynamicParams({
          type: 'weighted_mix',
          groups: groups.map((g) => ({ role: g.role, weight: g.weight })),
        });
      } else {
        // Classic TV Day — initialize time blocks from preset's schedule config
        const slots =
          'slots' in preset.scheduleConfig ? preset.scheduleConfig.slots : [];
        const blocks: TimeBlock[] = preset.contentRequirements.map((req) => {
          const matchingSlot = slots.find(
            (s) =>
              s.type === 'smart-collection' &&
              s.smartCollectionId === req.role &&
              'startTime' in s,
          );
          return {
            role: req.role,
            label: req.label,
            startTime:
              matchingSlot && 'startTime' in matchingSlot
                ? matchingSlot.startTime
                : 0,
          };
        });
        setTimeBlocks(blocks);
        setWeightedGroups([]);
        setDynamicRoles(
          blocks.map((b) => ({
            role: b.role,
            label: b.label,
            defaultQuery: {},
            required: true,
            minPrograms: 0,
          })),
        );
        setDynamicParams({
          type: 'classic_tv_day',
          blocks: blocks.map((b) => ({
            role: b.role,
            startTime: b.startTime,
          })),
        });
      }
    } else {
      setDynamicRoles([]);
      setWeightedGroups([]);
      setTimeBlocks([]);
      setDynamicParams(undefined);
    }

    setActiveStep(1);
  }, []);

  const handleGroupsChange = useCallback((groups: WeightedGroup[]) => {
    setWeightedGroups(groups);
    setDynamicRoles(
      groups.map((g) => ({
        role: g.role,
        label: g.label,
        defaultQuery: {},
        required: true,
        minPrograms: 1,
      })),
    );
    setDynamicParams({
      type: 'weighted_mix',
      groups: groups.map((g) => ({ role: g.role, weight: g.weight })),
    });
    // Clean up content assignments for removed roles
    setContentAssignments((prev) => {
      const roleSet = new Set(groups.map((g) => g.role));
      const cleaned: Record<string, ContentAssignment> = {};
      for (const [role, assignment] of Object.entries(prev)) {
        if (roleSet.has(role)) {
          cleaned[role] = assignment;
        }
      }
      return cleaned;
    });
  }, []);

  const handleBlocksChange = useCallback((blocks: TimeBlock[]) => {
    setTimeBlocks(blocks);
    setDynamicRoles(
      blocks.map((b) => ({
        role: b.role,
        label: b.label,
        defaultQuery: {},
        required: true,
        minPrograms: 0,
      })),
    );
    setDynamicParams({
      type: 'classic_tv_day',
      blocks: blocks.map((b) => ({ role: b.role, startTime: b.startTime })),
    });
    // Clean up content assignments for removed roles
    setContentAssignments((prev) => {
      const roleSet = new Set(blocks.map((b) => b.role));
      const cleaned: Record<string, ContentAssignment> = {};
      for (const [role, assignment] of Object.entries(prev)) {
        if (roleSet.has(role)) {
          cleaned[role] = assignment;
        }
      }
      return cleaned;
    });
  }, []);

  const handleNext = useCallback(() => {
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, []);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleCreate = useCallback(() => {
    if (!selectedPreset) return;

    const request: AutoChannelCreateRequest = {
      presetId: selectedPreset.id,
      contentAssignments,
      channelName: channelName || undefined,
      channelNumber: channelNumber || undefined,
      dynamicParams,
    };

    createMutation.mutate(request, {
      onSuccess: (channel) => {
        navigate({
          to: '/channels/$channelId/edit',
          params: { channelId: channel.id },
        }).catch(console.error);
      },
    });
  }, [
    selectedPreset,
    contentAssignments,
    channelName,
    channelNumber,
    dynamicParams,
    createMutation,
    navigate,
  ]);

  const totalPrograms = Object.values(previews).reduce(
    (sum, p) => sum + p.totalPrograms,
    0,
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <ChooseStyleStep
            presets={presets ?? []}
            presetsLoading={presetsLoading}
            selectedPresetId={selectedPreset?.id}
            onSelect={handlePresetSelect}
          />
        );
      case 1:
        return (
          <SelectContentStep
            preset={selectedPreset!}
            contentAssignments={contentAssignments}
            previews={previews}
            previewLoading={previewMutation.isPending}
            previewError={previewMutation.error}
            globalContext={globalContext}
            onGlobalContextChange={setGlobalContext}
            onContentChange={handleContentChange}
            dynamicRoles={dynamicRoles}
            weightedGroups={weightedGroups}
            onGroupsChange={handleGroupsChange}
            timeBlocks={timeBlocks}
            onBlocksChange={handleBlocksChange}
          />
        );
      case 2:
        return (
          <ReviewStep
            preset={selectedPreset!}
            previews={previews}
            channelName={channelName}
            channelNumber={channelNumber}
            onNameChange={setChannelName}
            onNumberChange={setChannelNumber}
            dynamicRoles={dynamicRoles}
            weightedGroups={weightedGroups}
            timeBlocks={timeBlocks}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Auto-Create Channel
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {!mediaSourcesLoading && (!mediaSources || mediaSources.length === 0) ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You need to configure at least one media source before using
          auto-channel creation. Add a Plex, Jellyfin, or Emby server in
          Settings &gt; Media Sources.
        </Alert>
      ) : (
        <PaddedPaper>{renderStepContent()}</PaddedPaper>
      )}

      {createMutation.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to create channel: {createMutation.error.message}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          Back
        </Button>

        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            endIcon={<ArrowForward />}
            onClick={handleNext}
            disabled={
              (activeStep === 0 && !selectedPreset) ||
              !mediaSources ||
              mediaSources.length === 0
            }
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreate}
            disabled={createMutation.isPending || totalPrograms === 0}
            startIcon={
              createMutation.isPending ? (
                <CircularProgress size={20} />
              ) : undefined
            }
          >
            {createMutation.isPending ? 'Creating...' : 'Create Channel'}
          </Button>
        )}
      </Box>
    </Box>
  );
}

// --- Step Components ---

function ChooseStyleStep({
  presets,
  presetsLoading,
  selectedPresetId,
  onSelect,
}: {
  presets: ChannelPreset[];
  presetsLoading: boolean;
  selectedPresetId: string | undefined;
  onSelect: (preset: ChannelPreset) => void;
}) {
  if (presetsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Choose a channel style
      </Typography>
      <Grid container spacing={2}>
        {presets.map((preset) => (
          <Grid key={preset.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <PresetCard
              preset={preset}
              selected={preset.id === selectedPresetId}
              onClick={() => onSelect(preset)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function SelectContentStep({
  preset,
  contentAssignments,
  previews,
  previewLoading,
  previewError,
  globalContext,
  onGlobalContextChange,
  onContentChange,
  dynamicRoles,
  weightedGroups,
  onGroupsChange,
  timeBlocks,
  onBlocksChange,
}: {
  preset: ChannelPreset;
  contentAssignments: Record<string, ContentAssignment>;
  previews: Record<string, ContentPreviewResponse>;
  previewLoading: boolean;
  previewError: Error | null;
  globalContext: GlobalContentContext;
  onGlobalContextChange: (ctx: GlobalContentContext) => void;
  onContentChange: (role: string, query: ContentQuery) => void;
  dynamicRoles: ContentRequirement[];
  weightedGroups: WeightedGroup[];
  onGroupsChange: (groups: WeightedGroup[]) => void;
  timeBlocks: TimeBlock[];
  onBlocksChange: (blocks: TimeBlock[]) => void;
}) {
  const isDynamic = preset.dynamicRequirements === true;
  const firstHint = preset.contentRequirements[0]?.pickerHint?.type;
  const isWeightedMix = isDynamic && firstHint === 'weighted_mix';
  const isClassicTv = isDynamic && firstHint === 'classic_tv';

  // For dynamic presets, use dynamicRoles; otherwise use preset's static roles
  const roles = isDynamic ? dynamicRoles : preset.contentRequirements;

  const renderRoleSection = (req: ContentRequirement) => (
    <RoleSection
      key={req.role}
      requirement={req}
      query={contentAssignments[req.role]?.query ?? req.defaultQuery}
      preview={previews[req.role]}
      previewLoading={previewLoading && !previews[req.role]}
      previewError={!previews[req.role] ? previewError : null}
      globalContext={globalContext}
      onQueryChange={(query) => onContentChange(req.role, query)}
    />
  );

  const makeDynamicRequirement = (
    role: string,
    label: string,
    minPrograms: number,
  ): ContentRequirement => ({
    role,
    label,
    defaultQuery: {},
    required: true,
    minPrograms,
  });

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Content for {preset.name}
      </Typography>

      <GlobalContentControls
        context={globalContext}
        onContextChange={onGlobalContextChange}
      />

      {isWeightedMix ? (
        <DynamicRoleManager
          groups={weightedGroups}
          onGroupsChange={onGroupsChange}
          min={preset.minBlocks ?? 2}
          max={preset.maxBlocks ?? 10}
          renderRoleContent={(group) =>
            renderRoleSection(
              makeDynamicRequirement(group.role, group.label, 1),
            )
          }
        />
      ) : isClassicTv ? (
        <BlockConfigurator
          blocks={timeBlocks}
          onBlocksChange={onBlocksChange}
          min={preset.minBlocks ?? 2}
          max={preset.maxBlocks ?? 8}
          renderRoleContent={(block) =>
            renderRoleSection(
              makeDynamicRequirement(block.role, block.label, 0),
            )
          }
        />
      ) : (
        roles.map((req) => renderRoleSection(req))
      )}
    </Box>
  );
}

function RoleSection({
  requirement,
  query,
  preview,
  previewLoading,
  previewError,
  globalContext,
  onQueryChange,
}: {
  requirement: ContentRequirement;
  query: ContentQuery;
  preview: ContentPreviewResponse | undefined;
  previewLoading: boolean;
  previewError: Error | null;
  globalContext: GlobalContentContext;
  onQueryChange: (query: ContentQuery) => void;
}) {
  const [advancedFilter, setAdvancedFilter] = useState('');

  const mediaSourceId = globalContext.mediaSourceId;
  const libraryId = globalContext.libraryIds?.[0];

  const handleFacetChange = useCallback(
    (_values: string[], filterString: string) => {
      const parts: string[] = [];
      if (filterString) parts.push(filterString);
      if (advancedFilter) parts.push(advancedFilter);
      onQueryChange({
        ...query,
        filterString: parts.length > 0 ? parts.join(' AND ') : undefined,
        mediaSourceIds: globalContext.mediaSourceId
          ? [globalContext.mediaSourceId]
          : undefined,
        libraryIds: globalContext.libraryIds,
      });
    },
    [query, advancedFilter, globalContext, onQueryChange],
  );

  const handleYearRangeChange = useCallback(
    (
      _range: { start: number; end: number } | undefined,
      filterString: string,
    ) => {
      const parts: string[] = [];
      if (filterString) parts.push(filterString);
      if (advancedFilter) parts.push(advancedFilter);
      onQueryChange({
        ...query,
        filterString: parts.length > 0 ? parts.join(' AND ') : undefined,
        mediaSourceIds: globalContext.mediaSourceId
          ? [globalContext.mediaSourceId]
          : undefined,
        libraryIds: globalContext.libraryIds,
      });
    },
    [query, advancedFilter, globalContext, onQueryChange],
  );

  const handleShowChange = useCallback(
    (show: { id: string; title: string; year: number | null } | null) => {
      onQueryChange({
        ...query,
        groupingId: show?.id ?? undefined,
        programTypes: show ? ['episode'] : query.programTypes,
        mediaSourceIds: globalContext.mediaSourceId
          ? [globalContext.mediaSourceId]
          : undefined,
        libraryIds: globalContext.libraryIds,
      });
    },
    [query, globalContext, onQueryChange],
  );

  const handleAdvancedFilterChange = useCallback(
    (value: string) => {
      setAdvancedFilter(value);
      const currentFilter = query.filterString ?? '';
      // Replace only the advanced portion (this is a simplification —
      // in practice we'd track picker filter vs advanced filter separately)
      onQueryChange({
        ...query,
        filterString: value || currentFilter || undefined,
        mediaSourceIds: globalContext.mediaSourceId
          ? [globalContext.mediaSourceId]
          : undefined,
        libraryIds: globalContext.libraryIds,
      });
    },
    [query, globalContext, onQueryChange],
  );

  const renderPicker = () => {
    const hint = requirement.pickerHint;
    if (!hint) return null;

    switch (hint.type) {
      case 'facet':
        return (
          <FacetPicker
            facetFields={hint.facetFields}
            label={hint.label}
            value={[]} // Controlled externally if needed
            onChange={handleFacetChange}
            mediaSourceId={mediaSourceId}
            libraryId={libraryId}
          />
        );
      case 'year-range':
        return (
          <YearRangePicker value={undefined} onChange={handleYearRangeChange} />
        );
      case 'single-show':
        return (
          <SingleShowPicker
            value={null}
            onChange={handleShowChange}
            mediaSourceId={mediaSourceId}
            libraryId={libraryId}
          />
        );
      case 'weighted_mix':
      case 'classic_tv':
        // These are handled by DynamicRoleManager/BlockConfigurator in Phase 4-5
        return null;
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
    >
      <Typography variant="subtitle1" fontWeight="bold">
        {requirement.label}
        {requirement.required && (
          <Typography component="span" color="error" sx={{ ml: 0.5 }}>
            *
          </Typography>
        )}
      </Typography>
      {requirement.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {requirement.description}
        </Typography>
      )}

      {renderPicker()}

      <AdvancedFilterSection
        filterString={advancedFilter}
        onFilterStringChange={handleAdvancedFilterChange}
      />

      <ContentPreview
        preview={preview}
        isLoading={previewLoading}
        error={previewError}
      />
    </Box>
  );
}

function ReviewStep({
  preset,
  previews,
  channelName,
  channelNumber,
  onNameChange,
  onNumberChange,
  dynamicRoles,
  weightedGroups,
  timeBlocks,
}: {
  preset: ChannelPreset;
  previews: Record<string, ContentPreviewResponse>;
  channelName: string;
  channelNumber: number | undefined;
  onNameChange: (name: string) => void;
  onNumberChange: (num: number | undefined) => void;
  dynamicRoles: ContentRequirement[];
  weightedGroups: WeightedGroup[];
  timeBlocks: TimeBlock[];
}) {
  const totalPrograms = Object.values(previews).reduce(
    (sum, p) => sum + p.totalPrograms,
    0,
  );

  const roleCount =
    dynamicRoles.length > 0
      ? dynamicRoles.length
      : preset.contentRequirements.length;

  const formatBlockTime = (ms: number) => {
    const totalMinutes = Math.floor(ms / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Review & Create
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <TextField
          label="Channel Name"
          value={channelName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={preset.name}
          helperText="Leave blank to auto-generate"
          fullWidth
        />
        <TextField
          label="Channel Number"
          type="number"
          value={channelNumber ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onNumberChange(isNaN(val) ? undefined : val);
          }}
          helperText="Leave blank to auto-assign"
          fullWidth
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Preset
        </Typography>
        <Typography>{preset.name}</Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Schedule Type
        </Typography>
        <Typography>
          {preset.scheduleType === 'random' ? 'Random Slots' : 'Time Slots'}
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Content
        </Typography>
        <Typography>
          {totalPrograms} program{totalPrograms !== 1 ? 's' : ''} across{' '}
          {roleCount} group{roleCount !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {weightedGroups.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Weighted Groups
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
            {weightedGroups.map((g) => (
              <Chip
                key={g.role}
                label={`${g.label}: weight ${g.weight}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>
      )}

      {timeBlocks.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Time Blocks
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
            {[...timeBlocks]
              .sort((a, b) => a.startTime - b.startTime)
              .map((b) => (
                <Chip
                  key={b.role}
                  label={`${b.label} @ ${formatBlockTime(b.startTime)}`}
                  size="small"
                  variant="outlined"
                />
              ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
