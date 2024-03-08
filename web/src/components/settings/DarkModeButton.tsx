import { FormControlLabel, Switch } from '@mui/material';
import { useStore } from 'zustand';
import { setDarkModeState } from '../../store/themeEditor/actions';

export default function DarkModeButton() {
  const darkMode = useStore((state) => state.theme.darkMode);

  return (
    <>
      <FormControlLabel
        control={
          <Switch checked={darkMode} onClick={() => setDarkModeState()} />
        }
        label="Dark Mode"
      />
    </>
  );
}
