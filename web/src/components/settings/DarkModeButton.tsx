import { Computer, DarkMode, LightMode } from '@mui/icons-material';
import {
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import useStore from '../../store/index.ts';
import { setThemePreference } from '../../store/themeEditor/actions';

type DarkModeProps = {
  iconOnly?: boolean;
};

type ThemeMode = 'light' | 'system' | 'dark';

export default function DarkModeButton(props: DarkModeProps) {
  const { iconOnly } = props;
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const schemePreference = useStore(
    (state) => state.theme.themePreference ?? 'system',
  );

  const isDarkMode =
    (schemePreference === 'system' && prefersDarkMode) ||
    schemePreference === 'dark';

  return (
    <>
      {iconOnly ? (
        <Tooltip title={`Enable ${isDarkMode ? 'light' : 'dark'} Mode`}>
          <IconButton
            color="inherit"
            onClick={() =>
              setThemePreference(
                schemePreference === 'light' ? 'dark' : 'light',
              )
            }
            sx={{ mx: 1 }}
          >
            {isDarkMode ? <LightMode /> : <DarkMode />}
          </IconButton>
        </Tooltip>
      ) : (
        <ToggleButtonGroup
          value={schemePreference}
          exclusive
          onChange={(_, value) => setThemePreference(value as ThemeMode)}
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
