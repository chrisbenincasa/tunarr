import { Box, Collapse, lighten, type Theme } from '@mui/material';
import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { useBoolean } from 'usehooks-ts';
import { useIsDarkMode } from '../hooks/useTunarrTheme.ts';
import type { Nullable } from '../types/util.ts';
import type { NestedGridProps } from './channel_config/MediaItemGrid.tsx';

interface InlineModalProps<ItemType> {
  open: boolean;
  modalItem: Nullable<ItemType>;
  depth: number;
  extractItemId: (item: ItemType) => string;
  renderNestedGrid: (props: NestedGridProps<ItemType>) => ReactNode;
}

export function InlineModal<ItemType>(props: InlineModalProps<ItemType>) {
  const { modalItem, open, extractItemId, depth, renderNestedGrid } = props;
  const itemGuid = modalItem ? extractItemId(modalItem) : null;
  const {
    value: isOpen,
    setTrue: setOpen,
    setFalse: setClosed,
  } = useBoolean(false);
  const inlineModalRef = useRef<HTMLDivElement>(null);
  const darkMode = useIsDarkMode();

  const backgroundColor = useCallback(
    (theme: Theme) => {
      if (darkMode) {
        return lighten(theme.palette.grey[800], depth / 10);
      }

      return theme.palette.grey[400];
    },
    [darkMode, depth],
  );

  return (
    <Box
      ref={inlineModalRef}
      component="div"
      className={
        `inline-modal-${itemGuid} ` +
        (open ? 'inline-modal-open ' : ' ') +
        (isOpen ? 'animation-done' : '')
      }
      sx={{
        display: isOpen ? 'grid' : 'none',
        gridColumn: isOpen ? '1 / -1' : undefined,
        mt: 'calc((var(--Grid-parent-rowSpacing) * -1) - 1px)',
      }}
    >
      <Collapse
        in={open}
        timeout={150}
        easing={{
          enter: 'easeInSine',
          exit: 'easeOutSine',
        }}
        mountOnEnter
        unmountOnExit
        sx={{
          width: '100%',
          display: 'grid',
          gridColumn: '1 / -1',
          backgroundColor,
        }}
        onEnter={setOpen}
        onExited={setClosed}
      >
        {modalItem && renderNestedGrid({ parent: modalItem, depth })}
      </Collapse>
    </Box>
  );
}
