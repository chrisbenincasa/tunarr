import { Delete } from '@mui/icons-material';
import {
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { ConditionClause, ClauseType } from './types.ts';
import {
  CLAUSE_TYPE_LABELS,
  COMPARISON_OPERATOR_LABELS,
  LIST_OPERATOR_LABELS,
  NUMERIC_OPERATOR_LABELS,
  PROGRAM_TYPES,
} from './types.ts';
import type { ComparisonOperator, ListOperator, NumericOperator } from './types.ts';
import { LanguageAutocomplete } from '@/components/LanguageAutocomplete.tsx';

interface Props {
  clause: ConditionClause;
  onChange: (clause: ConditionClause) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const CLAUSE_TYPES: ClauseType[] = [
  'program_type',
  'audio_language',
  'subtitle_language',
  'audio_channels',
];

export function ConditionClauseEditor({
  clause,
  onChange,
  onRemove,
  canRemove,
}: Props) {
  const handleTypeChange = (newType: ClauseType) => {
    switch (newType) {
      case 'always':
        onChange({ type: 'always' });
        break;
      case 'program_type':
        onChange({ type: 'program_type', operator: 'eq', value: 'movie' });
        break;
      case 'audio_language':
        onChange({ type: 'audio_language', operator: 'in', value: 'eng' });
        break;
      case 'subtitle_language':
        onChange({ type: 'subtitle_language', operator: 'in', value: 'eng' });
        break;
      case 'audio_channels':
        onChange({ type: 'audio_channels', operator: 'gte', value: 6 });
        break;
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minHeight: 40 }}>
      {/* Clause type selector */}
      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel>
          <Trans>Field</Trans>
        </InputLabel>
        <Select
          value={clause.type}
          label={t`Field`}
          onChange={(e) => handleTypeChange(e.target.value as ClauseType)}
        >
          {CLAUSE_TYPES.map((ct) => (
            <MenuItem key={ct} value={ct}>
              {t(CLAUSE_TYPE_LABELS[ct])}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Operator + value fields based on clause type */}
      {clause.type === 'program_type' && (
        <>
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <Select
              value={clause.operator}
              onChange={(e) =>
                onChange({
                  ...clause,
                  operator: e.target.value as ComparisonOperator,
                })
              }
            >
              {Object.entries(COMPARISON_OPERATOR_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {t(v)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={clause.value}
              onChange={(e) =>
                onChange({ ...clause, value: e.target.value })
              }
            >
              {PROGRAM_TYPES.map((pt) => (
                <MenuItem key={pt.value} value={pt.value}>
                  {t(pt.label)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}

      {clause.type === 'audio_language' && (
        <>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={clause.operator}
              onChange={(e) =>
                onChange({
                  ...clause,
                  operator: e.target.value as ListOperator,
                })
              }
            >
              {Object.entries(LIST_OPERATOR_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {t(v)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <LanguageAutocomplete
            values={clause.value ? [clause.value] : []}
            onSelect={({ iso6392 }) => onChange({ ...clause, value: iso6392 })}
            onRemove={() => onChange({ ...clause, value: '' })}
            onClear={() => onChange({ ...clause, value: '' })}
            textFieldProps={{
              size: 'small',
              sx: { minWidth: 180 },
            }}
          />
        </>
      )}

      {clause.type === 'subtitle_language' && (
        <>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={clause.operator}
              onChange={(e) =>
                onChange({
                  ...clause,
                  operator: e.target.value as ListOperator,
                })
              }
            >
              {Object.entries(LIST_OPERATOR_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {t(v)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <LanguageAutocomplete
            values={clause.value ? [clause.value] : []}
            onSelect={({ iso6392 }) => onChange({ ...clause, value: iso6392 })}
            onRemove={() => onChange({ ...clause, value: '' })}
            onClear={() => onChange({ ...clause, value: '' })}
            textFieldProps={{
              size: 'small',
              sx: { minWidth: 180 },
            }}
          />
        </>
      )}

      {clause.type === 'audio_channels' && (
        <>
          <FormControl size="small" sx={{ minWidth: 70 }}>
            <Select
              value={clause.operator}
              onChange={(e) =>
                onChange({
                  ...clause,
                  operator: e.target.value as NumericOperator,
                })
              }
            >
              {Object.entries(NUMERIC_OPERATOR_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            type="number"
            size="small"
            value={clause.value}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                onChange({ ...clause, value: val });
              }
            }}
            slotProps={{ htmlInput: { min: 1, max: 16 } }}
            sx={{ width: 80 }}
          />
        </>
      )}

      {/* Remove button */}
      <Tooltip title={t`Remove condition`}>
        <span>
          <IconButton size="small" onClick={onRemove} disabled={!canRemove}>
            <Delete fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
