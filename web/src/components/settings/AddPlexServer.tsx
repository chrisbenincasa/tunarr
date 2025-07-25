import { usePlexLogin } from '@/hooks/plex/usePlexLogin.tsx';
import type { SvgIconComponent } from '@mui/icons-material';
import { AddCircle } from '@mui/icons-material';
import { Button } from '@mui/material';

type AddPlexServer = {
  title?: string;
  variant?: 'text' | 'contained' | 'outlined' | undefined;
  icon?: SvgIconComponent;
};

export default function AddPlexServer({
  title = 'Add',
  variant = 'contained',
  ...restProps
}: AddPlexServer) {
  const IconComponent = restProps.icon ?? AddCircle;
  const addPlexServer = usePlexLogin();

  return (
    <Button
      color="inherit"
      onClick={addPlexServer}
      variant={variant}
      startIcon={<IconComponent />}
      {...restProps}
    >
      {title}
    </Button>
  );
}
