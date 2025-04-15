import ToggleButton, {
  type ToggleButtonProps,
} from '@mui/material/ToggleButton';
import React from 'react';

type Props = {
  children: React.ReactNode;
  selected: boolean;
  onToggle: () => void;
  toggleButtonProps?: Partial<ToggleButtonProps>;
  disabled?: boolean;
};

const defaultProps: Partial<Props> = {
  toggleButtonProps: {},
};

export default function StandaloneToggleButton({
  children,
  selected,
  onToggle,
  toggleButtonProps,
  disabled = false,
}: Props) {
  return (
    <ToggleButton
      {...(toggleButtonProps ?? defaultProps.toggleButtonProps)}
      disabled={disabled}
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
