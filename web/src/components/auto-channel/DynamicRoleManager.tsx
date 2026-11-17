import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useCallback } from 'react';

export type WeightedGroup = {
  role: string;
  label: string;
  weight: number;
};

type Props = {
  groups: WeightedGroup[];
  onGroupsChange: (groups: WeightedGroup[]) => void;
  min: number;
  max: number;
  renderRoleContent: (group: WeightedGroup, index: number) => React.ReactNode;
};

const weightMarks = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

function nextGroupId(groups: WeightedGroup[]): string {
  let maxNum = 0;
  for (const group of groups) {
    const match = group.role.match(/^group_(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `group_${maxNum + 1}`;
}

export function DynamicRoleManager({
  groups,
  onGroupsChange,
  min,
  max,
  renderRoleContent,
}: Props) {
  const canRemove = groups.length > min;
  const canAdd = groups.length < max;

  const handleWeightChange = useCallback(
    (index: number, value: number) => {
      const updated = groups.map((g, i) =>
        i === index ? { ...g, weight: value } : g,
      );
      onGroupsChange(updated);
    },
    [groups, onGroupsChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      if (!canRemove) return;
      const updated = groups.filter((_, i) => i !== index);
      onGroupsChange(updated);
    },
    [groups, canRemove, onGroupsChange],
  );

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    const role = nextGroupId(groups);
    const num = role.replace('group_', '');
    const newGroup: WeightedGroup = {
      role,
      label: `Group ${num}`,
      weight: 1,
    };
    onGroupsChange([...groups, newGroup]);
  }, [groups, canAdd, onGroupsChange]);

  return (
    <Stack spacing={2}>
      {groups.map((group, index) => (
        <Paper key={group.role} variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Typography variant="subtitle1" fontWeight="medium">
              {group.label}
            </Typography>
            <IconButton
              size="small"
              onClick={() => handleRemove(index)}
              disabled={!canRemove}
              aria-label={`Remove ${group.label}`}
            >
              <Close fontSize="small" />
            </IconButton>
          </Stack>

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ mb: 2, px: 1 }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ flexShrink: 0 }}
            >
              Weight:
            </Typography>
            <Slider
              value={group.weight}
              onChange={(_, value) => handleWeightChange(index, value)}
              min={1}
              max={10}
              step={1}
              marks={weightMarks}
              valueLabelDisplay="auto"
              sx={{ mx: 2 }}
            />
            <Typography
              variant="body2"
              fontWeight="bold"
              sx={{ flexShrink: 0, minWidth: 24, textAlign: 'right' }}
            >
              {group.weight}
            </Typography>
          </Stack>

          <Box>{renderRoleContent(group, index)}</Box>
        </Paper>
      ))}

      <Button
        startIcon={<Add />}
        onClick={handleAdd}
        disabled={!canAdd}
        variant="outlined"
        size="small"
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Group
      </Button>
    </Stack>
  );
}
