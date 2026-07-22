import { AdvancedFilterSection } from '@/components/auto-channel/AdvancedFilterSection';
import { ContentPreview } from '@/components/auto-channel/ContentPreview';
import {
  GlobalContentControls,
  type GlobalContentContext,
} from '@/components/auto-channel/GlobalContentControls';
import { PresetCard } from '@/components/auto-channel/PresetCard';
import { FacetPicker } from '@/components/auto-channel/content-pickers/FacetPicker';
import { SingleShowPicker } from '@/components/auto-channel/content-pickers/SingleShowPicker';
import { YearRangePicker } from '@/components/auto-channel/content-pickers/YearRangePicker';
import PaddedPaper from '@/components/base/PaddedPaper';
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
  CircularProgress,
  Grid,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type {
  AutoChannelCreateRequest,
  ChannelPreset,
  ContentAssignment,
  ContentPreviewResponse,
  ContentQuery,
  ContentRequirement,
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
    setActiveStep(1);
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

      <PaddedPaper>{renderStepContent()}</PaddedPaper>

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
            disabled={activeStep === 0 && !selectedPreset}
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

  // Group presets by category
  const categoryLabels: Record<string, string> = {
    simple: 'Simple',
    binge: 'Binge',
    genre: 'Themed',
    people: 'People',
    decade: 'Decades',
    network: 'Networks',
    'classic-tv': 'Structured',
    movie: 'Movies',
    music: 'Music',
    custom: 'Custom',
  };

  const grouped = new Map<string, ChannelPreset[]>();
  for (const preset of presets) {
    const list = grouped.get(preset.category) ?? [];
    list.push(preset);
    grouped.set(preset.category, list);
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Choose a channel style
      </Typography>
      {[...grouped.entries()].map(([category, categoryPresets]) => (
        <Box key={category} sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ mb: 1, display: 'block' }}
          >
            {categoryLabels[category] ?? category}
          </Typography>
          <Grid container spacing={2}>
            {categoryPresets.map((preset) => (
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
      ))}
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
}: {
  preset: ChannelPreset;
  contentAssignments: Record<string, ContentAssignment>;
  previews: Record<string, ContentPreviewResponse>;
  previewLoading: boolean;
  previewError: Error | null;
  globalContext: GlobalContentContext;
  onGlobalContextChange: (ctx: GlobalContentContext) => void;
  onContentChange: (role: string, query: ContentQuery) => void;
}) {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Content for {preset.name}
      </Typography>

      <GlobalContentControls
        context={globalContext}
        onContextChange={onGlobalContextChange}
      />

      {preset.contentRequirements.map((req) => (
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
      ))}
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
    (_range: { start: number; end: number } | undefined, filterString: string) => {
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
    <Box sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
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
}: {
  preset: ChannelPreset;
  previews: Record<string, ContentPreviewResponse>;
  channelName: string;
  channelNumber: number | undefined;
  onNameChange: (name: string) => void;
  onNumberChange: (num: number | undefined) => void;
}) {
  const totalPrograms = Object.values(previews).reduce(
    (sum, p) => sum + p.totalPrograms,
    0,
  );

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
          {preset.contentRequirements.length} role
          {preset.contentRequirements.length !== 1 ? 's' : ''}
        </Typography>
      </Box>
    </Box>
  );
}
