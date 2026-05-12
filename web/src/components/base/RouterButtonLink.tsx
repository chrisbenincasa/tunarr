import type {
  ButtonProps,
  IconButtonProps,
  MenuItemProps,
} from '@mui/material';
import { Button, IconButton, MenuItem } from '@mui/material';
import type { LinkComponent } from '@tanstack/react-router';
import { createLink } from '@tanstack/react-router';
import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface MUIButtonLinkProps extends ButtonProps<'a'> {
  // Add any additional props you want to pass to the Button
}

const MUIButtonLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  MUIButtonLinkProps
>((props, ref) => <Button ref={ref} component="a" {...props} />);

const CreatedButtonLinkComponent = createLink(MUIButtonLinkComponent);

export const RouterButtonLink: LinkComponent<typeof MUIButtonLinkComponent> = (
  props,
) => {
  return <CreatedButtonLinkComponent {...props} />;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface MUIIconButtonProps extends IconButtonProps<'a'> {}

const MUIIconButtonLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  MUIIconButtonProps
>((props, ref) => <IconButton ref={ref} component="a" {...props} />);

const CreatedIconButtonLinkComponent = createLink(MUIIconButtonLinkComponent);

export const RouterIconButtonLink: LinkComponent<
  typeof MUIIconButtonLinkComponent
> = (props) => <CreatedIconButtonLinkComponent {...props} />;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface MUIMenuItemProps extends MenuItemProps<'a'> {}

const MenuItemLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  MUIMenuItemProps
>((props, ref) => <MenuItem ref={ref} component="a" {...props} />);

const CreatedMenuItemLinkComponent = createLink(MenuItemLinkComponent);

export const MenuItemLink: LinkComponent<typeof MenuItemLinkComponent> = (
  props,
) => <CreatedMenuItemLinkComponent {...props} />;
