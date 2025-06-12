import { Computer, DarkMode, LightMode } from '@mui/icons-material';
import {
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useColorScheme,
} from '@mui/material';
import { useIsDarkMode } from '../../hooks/useTunarrTheme.ts';

type DarkModeProps = {
  iconOnly?: boolean;
};

type ThemeMode = 'light' | 'system' | 'dark';

export default function DarkModeButton(props: DarkModeProps) {
  const { iconOnly } = props;
  const { mode, setMode } = useColorScheme();
  const isDarkMode = useIsDarkMode();

  return (
    <>
      {iconOnly ? (
        <Tooltip title={`Enable ${isDarkMode ? 'light' : 'dark'} Mode`}>
          <IconButton
            color="inherit"
            onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
            sx={{ mx: 1 }}
          >
            {isDarkMode ? <LightMode /> : <DarkMode />}
          </IconButton>
        </Tooltip>
      ) : (
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, value) => setMode(value as ThemeMode)}
          aria-label="text alignment"
        >
          <ToggleButton value="light" aria-label="left aligned">
            <LightMode fontSize="small" sx={{ mr: 1 }} /> Light
          </ToggleButton>
          <ToggleButton value="system" aria-label="left aligned">
            <Computer fontSize="small" sx={{ mr: 1 }} /> System
          </ToggleButton>
          <ToggleButton value="dark" aria-label="centered">
            <DarkMode fontSize="small" sx={{ mr: 1 }} />
            Dark
          </ToggleButton>
        </ToggleButtonGroup>
      )}
    </>
  );
}
