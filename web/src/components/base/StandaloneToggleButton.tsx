import ToggleButton, { ToggleButtonProps } from '@mui/material/ToggleButton';
import React from 'react';

type Props = {
  children: React.ReactNode;
  selected: boolean;
  onToggle(): void;
  toggleButtonProps?: Partial<ToggleButtonProps>;
};

const defaultProps: Partial<Props> = {
  toggleButtonProps: {},
};

export default function StandaloneToggleButton({
  children,
  selected,
  onToggle,
  toggleButtonProps,
}: Props) {
  return (
    <ToggleButton
      {...(toggleButtonProps ?? defaultProps.toggleButtonProps)}
      value="check"
      selected={selected}
      onChange={() => {
        onToggle();
      }}
    >
      {children}
    </ToggleButton>
  );
}
