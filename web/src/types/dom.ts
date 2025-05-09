import type { PopoverVirtualElement } from '@mui/material/Popover';

export type PopoverAnchorEl =
  | null
  | Element
  | PopoverVirtualElement
  | (() => Element | PopoverVirtualElement | null);
