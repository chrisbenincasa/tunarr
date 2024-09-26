import useStore from '@/store';
import { setProgrammingSelectorViewState } from '@/store/themeEditor/actions';
import { ProgramSelectorViewType } from '@/types';
import { GridView, ViewList } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

export const ProgramViewToggleButton = () => {
  const viewType = useStore((state) => state.theme.programmingSelectorView);

  const handleFormat = (
    _event: React.MouseEvent<HTMLElement>,
    viewType: ProgramSelectorViewType,
  ) => {
    if (viewType !== null) {
      setProgrammingSelectorViewState(viewType);
    }
  };

  return (
    <ToggleButtonGroup value={viewType} onChange={handleFormat} exclusive>
      <ToggleButton value="list">
        <ViewList />
      </ToggleButton>
      <ToggleButton value="grid">
        <GridView />
      </ToggleButton>
    </ToggleButtonGroup>
  );
};
