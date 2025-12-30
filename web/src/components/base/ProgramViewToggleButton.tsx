import useStore from '@/store';
import { setProgrammingSelectorViewState } from '@/store/themeEditor/actions';
import type { ProgramSelectorViewType } from '@/types';
import { GridView, ViewList } from '@mui/icons-material';
import type { SxProps } from '@mui/material';
import { Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';

type Props = {
  sx?: SxProps;
};

export const ProgramViewToggleButton = ({ sx }: Props) => {
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
    <Stack direction={'row'} sx={sx}>
      <ToggleButtonGroup
        value={viewType}
        onChange={handleFormat}
        exclusive
        // sx={sx}
      >
        <Tooltip title="Grid">
          <ToggleButton value="grid">
            <GridView />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="List">
          <ToggleButton value="list">
            <ViewList />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </Stack>
  );
};
