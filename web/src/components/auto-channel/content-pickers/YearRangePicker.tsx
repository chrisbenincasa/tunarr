import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useState } from 'react';

const DECADES = [
  { label: '1950s', start: 1950, end: 1959 },
  { label: '1960s', start: 1960, end: 1969 },
  { label: '1970s', start: 1970, end: 1979 },
  { label: '1980s', start: 1980, end: 1989 },
  { label: '1990s', start: 1990, end: 1999 },
  { label: '2000s', start: 2000, end: 2009 },
  { label: '2010s', start: 2010, end: 2019 },
  { label: '2020s', start: 2020, end: 2029 },
];

type YearRange = { start: number; end: number };

type Props = {
  value: YearRange | undefined;
  onChange: (range: YearRange | undefined, filterString: string) => void;
};

export function YearRangePicker({ value, onChange }: Props) {
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const buildFilterString = useCallback((range: YearRange | undefined) => {
    if (!range) return '';
    return `year >= ${range.start} AND year <= ${range.end}`;
  }, []);

  const handleDecadeClick = useCallback(
    (decade: (typeof DECADES)[number]) => {
      const isSame =
        value?.start === decade.start && value?.end === decade.end;
      const newRange = isSame ? undefined : decade;
      onChange(newRange, buildFilterString(newRange));
    },
    [value, onChange, buildFilterString],
  );

  const handleCustomApply = useCallback(() => {
    const start = parseInt(customStart, 10);
    const end = parseInt(customEnd, 10);
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      const range = { start, end };
      onChange(range, buildFilterString(range));
    }
  }, [customStart, customEnd, onChange, buildFilterString]);

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {DECADES.map((decade) => {
          const isSelected =
            value?.start === decade.start && value?.end === decade.end;
          return (
            <Button
              key={decade.label}
              variant={isSelected ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handleDecadeClick(decade)}
            >
              {decade.label}
            </Button>
          );
        })}
      </Box>

      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2" color="text.secondary">
          Custom:
        </Typography>
        <TextField
          size="small"
          placeholder="Start"
          value={customStart}
          onChange={(e) => setCustomStart(e.target.value)}
          sx={{ width: 80 }}
          type="number"
        />
        <Typography variant="body2">—</Typography>
        <TextField
          size="small"
          placeholder="End"
          value={customEnd}
          onChange={(e) => setCustomEnd(e.target.value)}
          sx={{ width: 80 }}
          type="number"
        />
        <Button size="small" onClick={handleCustomApply}>
          Apply
        </Button>
      </Stack>

      {value && (
        <Typography variant="body2" color="text.secondary">
          Showing content from {value.start} to {value.end}
        </Typography>
      )}
    </Stack>
  );
}
