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
import {
  blockLimits,
  canExportPreset,
  parseChannelTemplate,
  templateFileName,
  toChannelTemplate,
  type WizardTemplateState,
} from '@/components/auto-channel/channelTemplate';
import { FacetPicker } from '@/components/auto-channel/content-pickers/FacetPicker';
import { SingleShowPicker } from '@/components/auto-channel/content-pickers/SingleShowPicker';
import { YearRangePicker } from '@/components/auto-channel/content-pickers/YearRangePicker';
import type { RoleSelection } from '@/components/auto-channel/roleQuery';
import {
  buildRoleQuery,
  hasRequiredPick,
} from '@/components/auto-channel/roleQuery';
import { rolePreviewStatus } from '@/components/auto-channel/rolePreviewStatus';
import { SimpleContentControls } from '@/components/auto-channel/SimpleContentControls';
import PaddedPaper from '@/components/base/PaddedPaper';
import { RouterButtonLink } from '@/components/base/RouterButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonoText } from '@/components/ui/MonoText';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { getApiMediaSourcesOptions } from '@/generated/@tanstack/react-query.gen';
import {
  useAutoChannelPresets,
  useAutoCreateChannel,
  useRolePreviews,
  type RolePreview,
} from '@/hooks/useAutoChannel';
import { useDownload } from '@/hooks/useDownload';
import {
  ArrowBack,
  ArrowForward,
  FileDownload,
  FileUpload,
  VideoLibrary,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Grid,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { MediaSourceId } from '@tunarr/shared';
import { tag } from '@tunarr/types';
import type {
  AutoChannelCreateRequest,
  ChannelPreset,
  ContentQuery,
  ContentRequirement,
  DynamicPresetParams,
} from '@tunarr/types/api';
import { mapValues, pick } from 'lodash-es';
import type { ChangeEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

const steps = ['Choose Style', 'Select Content', 'Review & Create'];

export function AutoCreateWizard() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<ChannelPreset | null>(
    null,
  );
  const [roleSelections, setRoleSelections] = useState<
    Record<string, RoleSelection>
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
  const [importError, setImportError] = useState<string>();
  const download = useDownload();

  const { data: mediaSources, isLoading: mediaSourcesLoading } = useQuery(
    getApiMediaSourcesOptions(),
  );
  const { data: presets, isLoading: presetsLoading } = useAutoChannelPresets();
  const createMutation = useAutoCreateChannel();

  const roles = useMemo(() => {
    if (!selectedPreset) {
      return [];
    }
    return selectedPreset.dynamicRequirements
      ? dynamicRoles
      : selectedPreset.contentRequirements;
  }, [selectedPreset, dynamicRoles]);

  const roleQueries = useMemo(
    () =>
      Object.fromEntries(
        roles.map((req) => [
          req.role,
          buildRoleQuery(
            req.defaultQuery,
            roleSelections[req.role],
            globalContext,
          ),
        ]),
      ),
    [roles, roleSelections, globalContext],
  );

  const previewQueries = useMemo(
    () =>
      Object.fromEntries(
        roles.map((req) => [
          req.role,
          hasRequiredPick(req, roleSelections[req.role])
            ? roleQueries[req.role]
            : undefined,
        ]),
      ),
    [roles, roleSelections, roleQueries],
  );

  const previews = useRolePreviews(previewQueries);

  const handleSelectionChange = useCallback(
    (role: string, selection: RoleSelection) => {
      setRoleSelections((prev) => ({ ...prev, [role]: selection }));
    },
    [],
  );

  const handlePresetSelect = useCallback((preset: ChannelPreset) => {
    setSelectedPreset(preset);
    setChannelName('');
    setChannelNumber(undefined);
    setRoleSelections({});
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
            (s) => s.type === 'role' && s.role === req.role && 'startTime' in s,
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
    setRoleSelections((prev) =>
      pick(
        prev,
        groups.map((g) => g.role),
      ),
    );
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
    setRoleSelections((prev) =>
      pick(
        prev,
        blocks.map((b) => b.role),
      ),
    );
  }, []);

  const handleImport = useCallback(
    (text: string) => {
      const parsed = parseChannelTemplate(text, presets ?? []);
      if (!parsed.ok) {
        setImportError(parsed.error);
        return;
      }
      const { state } = parsed;
      setImportError(undefined);
      handlePresetSelect(state.preset);
      if (state.weightedGroups.length > 0) {
        handleGroupsChange(state.weightedGroups);
      }
      if (state.timeBlocks.length > 0) {
        handleBlocksChange(state.timeBlocks);
      }
      setRoleSelections(state.roleSelections);
      setChannelName(state.channelName);
    },
    [presets, handlePresetSelect, handleGroupsChange, handleBlocksChange],
  );

  const handleExport = useCallback(() => {
    if (!selectedPreset) return;

    const state: WizardTemplateState = {
      preset: selectedPreset,
      channelName,
      weightedGroups,
      timeBlocks,
      roleSelections,
    };
    const template = toChannelTemplate(
      state,
      roles.map((r) => r.role),
    );
    download(
      JSON.stringify(template, null, 2),
      templateFileName(template),
      'application/json',
    );
  }, [
    selectedPreset,
    channelName,
    weightedGroups,
    timeBlocks,
    roleSelections,
    roles,
    download,
  ]);

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
      contentAssignments: mapValues(roleQueries, (query) => ({ query })),
      channelName: channelName || undefined,
      channelNumber: channelNumber || undefined,
      dynamicParams,
    };

    createMutation.mutate(request, {
      onSuccess: (channel) => {
        navigate({
          to: '/channels/$channelId',
          params: { channelId: channel.id },
        }).catch(console.error);
      },
    });
  }, [
    selectedPreset,
    roleQueries,
    channelName,
    channelNumber,
    dynamicParams,
    createMutation,
    navigate,
  ]);

  const totalPrograms = Object.values(previews).reduce(
    (sum, p) => sum + (p.data?.totalPrograms ?? 0),
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
            onSelect={(preset) => {
              setImportError(undefined);
              handlePresetSelect(preset);
            }}
            onImport={handleImport}
            importError={importError}
          />
        );
      case 1:
        if (!selectedPreset) {
          return null;
        }
        return (
          <SelectContentStep
            preset={selectedPreset}
            roles={roles}
            roleQueries={roleQueries}
            roleSelections={roleSelections}
            previews={previews}
            globalContext={globalContext}
            onGlobalContextChange={setGlobalContext}
            onSelectionChange={handleSelectionChange}
            weightedGroups={weightedGroups}
            onGroupsChange={handleGroupsChange}
            timeBlocks={timeBlocks}
            onBlocksChange={handleBlocksChange}
          />
        );
      case 2:
        if (!selectedPreset) {
          return null;
        }
        return (
          <ReviewStep
            preset={selectedPreset}
            totalPrograms={totalPrograms}
            roleCount={roles.length}
            channelName={channelName}
            channelNumber={channelNumber}
            onNameChange={setChannelName}
            onNumberChange={setChannelNumber}
            weightedGroups={weightedGroups}
            timeBlocks={timeBlocks}
            onExport={handleExport}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <PageHeader
        title="Auto-Create Channel"
        subtitle="Pick a channel style, choose content from your libraries, and Tunarr builds the schedule."
      />

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label, index) => (
          <Step key={label}>
            {index < activeStep ? (
              <StepButton onClick={() => setActiveStep(index)}>
                {label}
              </StepButton>
            ) : (
              <StepLabel>{label}</StepLabel>
            )}
          </Step>
        ))}
      </Stepper>

      {!mediaSourcesLoading && (!mediaSources || mediaSources.length === 0) ? (
        <PaddedPaper>
          <EmptyState
            icon={<VideoLibrary />}
            title="Add a media source first"
            description="Auto-create builds channels from your libraries. Add a Plex, Jellyfin, Emby, or local source, then come back."
            actions={
              <RouterButtonLink to="/settings/sources" variant="contained">
                Go to Sources
              </RouterButtonLink>
            }
          />
        </PaddedPaper>
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
  onImport,
  importError,
}: {
  presets: ChannelPreset[];
  presetsLoading: boolean;
  selectedPresetId: string | undefined;
  onSelect: (preset: ChannelPreset) => void;
  onImport: (text: string) => void;
  importError: string | undefined;
}) {
  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    // Clear the input so picking the same file again still fires a change.
    e.target.value = '';
    if (file === undefined) {
      return;
    }
    file.text().then(onImport).catch(console.error);
  };

  if (presetsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6">Choose a channel style</Typography>
        <Button component="label" startIcon={<FileUpload />}>
          Import template
          <input
            hidden
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
          />
        </Button>
      </Stack>
      {importError !== undefined && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {importError}
        </Alert>
      )}
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
  roles,
  roleQueries,
  roleSelections,
  previews,
  globalContext,
  onGlobalContextChange,
  onSelectionChange,
  weightedGroups,
  onGroupsChange,
  timeBlocks,
  onBlocksChange,
}: {
  preset: ChannelPreset;
  roles: ContentRequirement[];
  roleQueries: Record<string, ContentQuery>;
  roleSelections: Record<string, RoleSelection>;
  previews: Record<string, RolePreview>;
  globalContext: GlobalContentContext;
  onGlobalContextChange: (ctx: GlobalContentContext) => void;
  onSelectionChange: (role: string, selection: RoleSelection) => void;
  weightedGroups: WeightedGroup[];
  onGroupsChange: (groups: WeightedGroup[]) => void;
  timeBlocks: TimeBlock[];
  onBlocksChange: (blocks: TimeBlock[]) => void;
}) {
  const isDynamic = preset.dynamicRequirements === true;
  const firstHint = preset.contentRequirements[0]?.pickerHint?.type;
  const isWeightedMix = isDynamic && firstHint === 'weighted_mix';
  const isClassicTv = isDynamic && firstHint === 'classic_tv';

  const renderRoleSection = (role: string) => {
    const req = roles.find((r) => r.role === role);
    if (!req) {
      return null;
    }

    return (
      <RoleSection
        key={req.role}
        requirement={req}
        query={roleQueries[req.role] ?? req.defaultQuery}
        selection={roleSelections[req.role] ?? {}}
        preview={previews[req.role]}
        globalContext={globalContext}
        onSelectionChange={(selection) =>
          onSelectionChange(req.role, selection)
        }
      />
    );
  };

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
          {...blockLimits(preset)}
          renderRoleContent={(group) => renderRoleSection(group.role)}
        />
      ) : isClassicTv ? (
        <BlockConfigurator
          blocks={timeBlocks}
          onBlocksChange={onBlocksChange}
          {...blockLimits(preset)}
          renderRoleContent={(block) => renderRoleSection(block.role)}
        />
      ) : (
        roles.map((req) => renderRoleSection(req.role))
      )}
    </Box>
  );
}

function RoleSection({
  requirement,
  query,
  selection,
  preview,
  globalContext,
  onSelectionChange,
}: {
  requirement: ContentRequirement;
  query: ContentQuery;
  selection: RoleSelection;
  preview: RolePreview | undefined;
  globalContext: GlobalContentContext;
  onSelectionChange: (selection: RoleSelection) => void;
}) {
  const update = (patch: Partial<RoleSelection>) =>
    onSelectionChange({ ...selection, ...patch });

  const mediaSourceId =
    selection.override?.mediaSourceIds?.[0] ?? globalContext.mediaSourceId;
  const libraryId =
    selection.override?.libraryIds?.[0] ?? globalContext.libraryIds?.[0];

  const handleOverrideToggle = (enabled: boolean) =>
    update({
      override: enabled
        ? {
            mediaSourceIds: query.mediaSourceIds,
            libraryIds: query.libraryIds,
            programTypes: query.programTypes,
          }
        : undefined,
    });

  const renderPicker = () => {
    const hint = requirement.pickerHint;
    if (!hint) return null;

    switch (hint.type) {
      case 'facet':
        return (
          <FacetPicker
            facetFields={hint.facetFields}
            label={hint.label}
            field={selection.facetField}
            value={selection.facetValues ?? []}
            onChange={(facetValues, pickerFilter, facetField) =>
              update({ facetField, facetValues, pickerFilter })
            }
            mediaSourceId={mediaSourceId}
            libraryId={libraryId}
          />
        );
      case 'year-range':
        return (
          <YearRangePicker
            value={selection.yearRange}
            onChange={(yearRange, pickerFilter) =>
              update({ yearRange, pickerFilter })
            }
          />
        );
      case 'single-show':
        return (
          <SingleShowPicker
            value={selection.show ?? null}
            onChange={(show) => update({ show: show ?? undefined })}
            mediaSourceId={mediaSourceId}
            libraryId={libraryId}
          />
        );
      case 'weighted_mix':
      case 'classic_tv':
        // DynamicRoleManager and BlockConfigurator render these presets.
        return null;
      default:
        return null;
    }
  };

  const totalPrograms = preview?.data?.totalPrograms;
  const tooFew =
    totalPrograms !== undefined &&
    totalPrograms > 0 &&
    totalPrograms < requirement.minPrograms;
  const previewStatus = rolePreviewStatus(preview, requirement.minPrograms);

  return (
    <Box
      sx={{ mb: 3, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
      >
        <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
          <Typography variant="subtitle1" fontWeight="bold">
            {requirement.label}
            {requirement.required && (
              <Typography component="span" color="error" sx={{ ml: 0.5 }}>
                *
              </Typography>
            )}
          </Typography>
          <StatusPill
            status={previewStatus.status}
            label={previewStatus.label}
          />
        </Stack>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={selection.override !== undefined}
              onChange={(e) => handleOverrideToggle(e.target.checked)}
            />
          }
          label="Override"
        />
      </Stack>
      {requirement.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {requirement.description}
        </Typography>
      )}

      {selection.override && (
        <Box sx={{ mb: 2 }}>
          <SimpleContentControls
            query={selection.override}
            onQueryChange={(q) =>
              update({
                override: {
                  mediaSourceIds: q.mediaSourceIds,
                  libraryIds: q.libraryIds,
                  programTypes: q.programTypes,
                },
              })
            }
            compact
          />
        </Box>
      )}

      {renderPicker()}

      <AdvancedFilterSection
        filterString={selection.advancedFilter ?? ''}
        onFilterStringChange={(advancedFilter) => update({ advancedFilter })}
        mediaSourceId={
          mediaSourceId !== undefined
            ? tag<MediaSourceId>(mediaSourceId)
            : undefined
        }
        libraryId={libraryId}
      />

      {tooFew && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Only {totalPrograms} program{totalPrograms === 1 ? '' : 's'} match.
          This role works best with at least {requirement.minPrograms}.
        </Alert>
      )}

      {preview?.awaitingInput ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {requirement.pickerHint?.label ?? 'Make a selection'} to preview
          matching programs.
        </Typography>
      ) : (
        <ContentPreview
          preview={preview?.data}
          isLoading={preview?.isLoading ?? true}
          error={preview?.error ?? null}
        />
      )}
    </Box>
  );
}

function ReviewStep({
  preset,
  totalPrograms,
  roleCount,
  channelName,
  channelNumber,
  onNameChange,
  onNumberChange,
  weightedGroups,
  timeBlocks,
  onExport,
}: {
  preset: ChannelPreset;
  totalPrograms: number;
  roleCount: number;
  channelName: string;
  channelNumber: number | undefined;
  onNameChange: (name: string) => void;
  onNumberChange: (num: number | undefined) => void;
  weightedGroups: WeightedGroup[];
  timeBlocks: TimeBlock[];
  onExport: () => void;
}) {
  const exportable = canExportPreset(preset);
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
          <MonoText>{totalPrograms.toLocaleString()}</MonoText> program
          {totalPrograms !== 1 ? 's' : ''} across{' '}
          <MonoText>{roleCount}</MonoText> group{roleCount !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {weightedGroups.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Weighted Groups
          </Typography>
          <Stack sx={{ mt: 0.5 }} gap={0.25}>
            {weightedGroups.map((g) => (
              <Stack key={g.role} direction="row" gap={1}>
                <Typography sx={{ flexGrow: 1 }}>{g.label}</Typography>
                <Typography color="text.secondary">
                  weight <MonoText>{g.weight}</MonoText>
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {timeBlocks.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Time Blocks
          </Typography>
          <Stack sx={{ mt: 0.5 }} gap={0.25}>
            {[...timeBlocks]
              .sort((a, b) => a.startTime - b.startTime)
              .map((b) => (
                <Stack key={b.role} direction="row" gap={2}>
                  <MonoText color="text.secondary" sx={{ minWidth: '8ch' }}>
                    {formatBlockTime(b.startTime)}
                  </MonoText>
                  <Typography>{b.label}</Typography>
                </Stack>
              ))}
          </Stack>
        </Box>
      )}

      <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
        <Button
          variant="outlined"
          startIcon={<FileDownload />}
          onClick={onExport}
          disabled={!exportable}
        >
          Export template
        </Button>
        <Typography variant="body2" color="text.secondary">
          {exportable
            ? 'Saves the style and your picks without your libraries, so others can build this channel from their own media.'
            : "Binge channels can't be exported yet, because the show is specific to this server."}
        </Typography>
      </Stack>
    </Box>
  );
}
