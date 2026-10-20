import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useCallback, useMemo } from 'react';

export type TimeBlock = {
  role: string;
  label: string;
  startTime: number; // ms offset from midnight
};

type Props = {
  blocks: TimeBlock[];
  onBlocksChange: (blocks: TimeBlock[]) => void;
  min: number;
  max: number;
  renderRoleContent: (block: TimeBlock, index: number) => React.ReactNode;
};

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MAX_START_TIME = 23 * MS_PER_HOUR + 59 * MS_PER_MINUTE;

function formatTime(ms: number): string {
  const totalMinutes = Math.floor(ms / MS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function nextBlockId(blocks: TimeBlock[]): string {
  let maxNum = 0;
  for (const block of blocks) {
    const match = block.role.match(/^block_(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `block_${maxNum + 1}`;
}

export function BlockConfigurator({
  blocks,
  onBlocksChange,
  min,
  max,
  renderRoleContent,
}: Props) {
  const canRemove = blocks.length > min;
  const canAdd = blocks.length < max;

  const sortedBlocks = useMemo(() => {
    const indexed = blocks.map((block, originalIndex) => ({
      block,
      originalIndex,
    }));
    indexed.sort((a, b) => a.block.startTime - b.block.startTime);
    return indexed;
  }, [blocks]);

  const handleTimeChange = useCallback(
    (index: number, hours: number, minutes: number) => {
      const clampedHours = Math.max(0, Math.min(23, hours));
      const clampedMinutes = Math.max(0, Math.min(59, minutes));
      const newStartTime =
        clampedHours * MS_PER_HOUR + clampedMinutes * MS_PER_MINUTE;
      const updated = blocks.map((b, i) =>
        i === index ? { ...b, startTime: newStartTime } : b,
      );
      onBlocksChange(updated);
    },
    [blocks, onBlocksChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      if (!canRemove) return;
      const updated = blocks.filter((_, i) => i !== index);
      onBlocksChange(updated);
    },
    [blocks, canRemove, onBlocksChange],
  );

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    const role = nextBlockId(blocks);
    const num = role.replace('block_', '');
    const lastBlock = blocks.length > 0 ? blocks[blocks.length - 1] : undefined;
    const defaultStartTime =
      lastBlock !== undefined
        ? Math.min(lastBlock.startTime + 3 * MS_PER_HOUR, MAX_START_TIME)
        : 0;
    const newBlock: TimeBlock = {
      role,
      label: `Block ${num}`,
      startTime: defaultStartTime,
    };
    onBlocksChange([...blocks, newBlock]);
  }, [blocks, canAdd, onBlocksChange]);

  return (
    <Stack spacing={2}>
      {sortedBlocks.map(({ block, originalIndex }) => {
        const hours = Math.floor(block.startTime / MS_PER_HOUR);
        const minutes = Math.floor(
          (block.startTime % MS_PER_HOUR) / MS_PER_MINUTE,
        );

        return (
          <Paper key={block.role} variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                {block.label}
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ flexShrink: 0 }}
                >
                  Time:
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  label="Hour"
                  value={hours}
                  onChange={(e) =>
                    handleTimeChange(
                      originalIndex,
                      parseInt(e.target.value, 10) || 0,
                      minutes,
                    )
                  }
                  slotProps={{
                    htmlInput: { min: 0, max: 23 },
                  }}
                  sx={{ width: 80 }}
                />
                <TextField
                  type="number"
                  size="small"
                  label="Min"
                  value={minutes}
                  onChange={(e) =>
                    handleTimeChange(
                      originalIndex,
                      hours,
                      parseInt(e.target.value, 10) || 0,
                    )
                  }
                  slotProps={{
                    htmlInput: { min: 0, max: 59 },
                  }}
                  sx={{ width: 80 }}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ flexShrink: 0, minWidth: 72 }}
                >
                  {formatTime(block.startTime)}
                </Typography>

                <IconButton
                  size="small"
                  onClick={() => handleRemove(originalIndex)}
                  disabled={!canRemove}
                  aria-label={`Remove ${block.label}`}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Box>{renderRoleContent(block, originalIndex)}</Box>
          </Paper>
        );
      })}

      <Button
        startIcon={<Add />}
        onClick={handleAdd}
        disabled={!canAdd}
        variant="outlined"
        size="small"
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Block
      </Button>
    </Stack>
  );
}
