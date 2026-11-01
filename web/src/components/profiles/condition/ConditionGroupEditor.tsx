import { Add } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Segmented } from '../../ui/Segmented.tsx';
import type {
  ConditionEntry,
  ConditionGroup,
  ConditionOperator,
} from './types.ts';
import {
  createDefaultClause,
  createDefaultGroup,
  isConditionGroup,
} from './types.ts';
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

  const handleOperatorChange = (newOp: ConditionOperator) => {
    onChange({ ...group, operator: newOp });
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
          <Segmented<ConditionOperator>
            aria-label={t`Condition operator`}
            value={group.operator}
            onChange={handleOperatorChange}
            options={[
              { value: 'and', label: t`ALL` },
              { value: 'or', label: t`ANY` },
            ]}
          />
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
