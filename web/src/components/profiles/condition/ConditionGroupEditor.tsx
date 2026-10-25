import { Add } from '@mui/icons-material';
import {
  Box,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import type { ConditionEntry, ConditionGroup, ConditionOperator } from './types.ts';
import { createDefaultClause, createDefaultGroup, isConditionGroup } from './types.ts';
import { ConditionClauseEditor } from './ConditionClauseEditor.tsx';

interface Props {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  depth?: number;
}

// Total number of leaf clauses across the entire tree
function countLeaves(group: ConditionGroup): number {
  let count = 0;
  for (const entry of group.conditions) {
    if (isConditionGroup(entry)) {
      count += countLeaves(entry);
    } else {
      count++;
    }
  }
  return count;
}

const BORDER_COLORS = [
  'primary.main',
  'secondary.main',
  'warning.main',
  'info.main',
] as const;

export function ConditionGroupEditor({ group, onChange, depth = 0 }: Props) {
  const borderColor = BORDER_COLORS[depth % BORDER_COLORS.length];
  const totalLeaves = countLeaves(group);

  const handleOperatorChange = (
    _: React.MouseEvent<HTMLElement>,
    newOp: ConditionOperator | null,
  ) => {
    if (newOp !== null) {
      onChange({ ...group, operator: newOp });
    }
  };

  const updateEntry = (index: number, entry: ConditionEntry) => {
    const next = [...group.conditions];
    next[index] = entry;
    onChange({ ...group, conditions: next });
  };

  const removeEntry = (index: number) => {
    const next = group.conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: next });
  };

  const addClause = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, createDefaultClause()],
    });
  };

  const addGroup = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, createDefaultGroup()],
    });
  };

  return (
    <Box
      sx={{
        borderLeft: 3,
        borderColor,
        pl: 2,
        py: 1,
      }}
    >
      <Stack spacing={1.5}>
        {/* Operator toggle */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            <Trans>Match</Trans>
          </Typography>
          <ToggleButtonGroup
            value={group.operator}
            exclusive
            onChange={handleOperatorChange}
            size="small"
          >
            <ToggleButton value="and" sx={{ px: 1.5, py: 0.25, textTransform: 'none' }}>
              {t`ALL`}
            </ToggleButton>
            <ToggleButton value="or" sx={{ px: 1.5, py: 0.25, textTransform: 'none' }}>
              {t`ANY`}
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="text.secondary">
            <Trans>of the following</Trans>
          </Typography>
        </Stack>

        {/* Condition entries */}
        {group.conditions.map((entry, idx) => {
          if (isConditionGroup(entry)) {
            return (
              <Box key={idx} sx={{ position: 'relative' }}>
                <ConditionGroupEditor
                  group={entry}
                  onChange={(updated) => updateEntry(idx, updated)}
                  depth={depth + 1}
                />
                <Button
                  size="small"
                  color="error"
                  onClick={() => removeEntry(idx)}
                  sx={{ mt: 0.5 }}
                >
                  <Trans>Remove group</Trans>
                </Button>
              </Box>
            );
          }

          return (
            <ConditionClauseEditor
              key={idx}
              clause={entry}
              onChange={(updated) => updateEntry(idx, updated)}
              onRemove={() => removeEntry(idx)}
              canRemove={totalLeaves > 1}
            />
          );
        })}

        {/* Add buttons */}
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={addClause}
            sx={{ textTransform: 'none' }}
          >
            <Trans>Add condition</Trans>
          </Button>
          {depth < 2 && (
            <Button
              size="small"
              startIcon={<Add />}
              onClick={addGroup}
              sx={{ textTransform: 'none' }}
              color="secondary"
            >
              <Trans>Add group</Trans>
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
