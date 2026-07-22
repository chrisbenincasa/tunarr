import {
  Business,
  CalendarMonth,
  Category,
  LiveTv,
  Movie,
  MusicNote,
  Person,
  PlaylistPlay,
  Shuffle,
  Tune,
} from '@mui/icons-material';
import {
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import type { ChannelPreset, ChannelPresetCategory } from '@tunarr/types/api';

const categoryIcons: Record<ChannelPresetCategory, React.ReactNode> = {
  simple: <Shuffle />,
  'classic-tv': <LiveTv />,
  movie: <Movie />,
  music: <MusicNote />,
  binge: <PlaylistPlay />,
  genre: <Category />,
  people: <Person />,
  decade: <CalendarMonth />,
  network: <Business />,
  custom: <Tune />,
};

const categoryLabels: Record<ChannelPresetCategory, string> = {
  simple: 'Simple',
  'classic-tv': 'Classic TV',
  movie: 'Movie',
  music: 'Music',
  binge: 'Binge',
  genre: 'Themed',
  people: 'People',
  decade: 'Decades',
  network: 'Networks',
  custom: 'Custom',
};

type PresetCardProps = {
  preset: ChannelPreset;
  selected: boolean;
  onClick: () => void;
};

export function PresetCard({ preset, selected, onClick }: PresetCardProps) {
  return (
    <Card
      variant={selected ? 'elevation' : 'outlined'}
      sx={{
        border: selected ? 2 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        transition: 'border-color 0.2s',
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2 }}>
        <CardContent sx={{ textAlign: 'center', p: 1 }}>
          {categoryIcons[preset.category]}
          <Typography variant="h6" sx={{ mt: 1 }}>
            {preset.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {preset.description}
          </Typography>
          <Chip
            label={categoryLabels[preset.category]}
            size="small"
            sx={{ mt: 1 }}
          />
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
