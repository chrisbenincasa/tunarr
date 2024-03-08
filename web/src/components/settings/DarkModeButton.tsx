import { DarkMode, LightMode } from '@mui/icons-material';
import { FormControlLabel, IconButton, Switch } from '@mui/material';
import useStore from '../../store/index.ts';
import { setDarkModeState } from '../../store/themeEditor/actions';

type DarkModeProps = {
  iconOnly?: boolean;
};

export default function DarkModeButton(props: DarkModeProps) {
  const { iconOnly } = props;
  const darkMode = useStore((state) => state.theme.darkMode);

  return (
    <>
      {iconOnly ? (
        <IconButton onClick={() => setDarkModeState()} sx={{ mx: 1 }}>
          {darkMode ? <DarkMode /> : <LightMode sx={{ color: '#fff' }} />}
        </IconButton>
      ) : (
        <FormControlLabel
          control={
            <Switch checked={darkMode} onClick={() => setDarkModeState()} />
          }
          label="Dark Mode"
        />
      )}
    </>
  );
}
