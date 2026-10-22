import type { TabProps } from '@mui/material';
import { Tab } from '@mui/material';
import type { LinkComponent } from '@tanstack/react-router';
import { createLink } from '@tanstack/react-router';
import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface MUIButtonLinkProps extends TabProps<'a'> {
  // Add any additional props you want to pass to the Button
}

const MUITabLinkComponent = React.forwardRef<
  HTMLAnchorElement,
  MUIButtonLinkProps
>((props, ref) => <Tab ref={ref} component="a" {...props} />);

const CreatedButtonLinkComponent = createLink(MUITabLinkComponent);

export const RouterTabLink: LinkComponent<typeof MUITabLinkComponent> = (
  props,
) => {
  return <CreatedButtonLinkComponent {...props} />;
};
