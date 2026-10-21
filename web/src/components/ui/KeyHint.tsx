import { alpha, styled } from '@mui/material';

export type KeyHintProps = {
  // Use 'onAccent' inside a contained primary button. Put the hint in the
  // button's children, not endIcon, because endIcon resizes it to 20px.
  tone?: 'default' | 'onAccent';
};

// One keyboard key, such as "N" or "⌘K". Put the action's words outside it.
export const KeyHint = styled('kbd', {
  name: 'KeyHint',
  shouldForwardProp: (prop) => prop !== 'tone',
})<KeyHintProps>(({ theme, tone = 'default' }) => {
  const tokens = theme.palette.tokens;
  const onAccent = tone === 'onAccent';

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '1.75em',
    paddingInline: '5px',
    boxSizing: 'border-box',
    borderRadius: '4px',
    border: '1px solid',
    borderColor: onAccent ? 'transparent' : tokens.borderStrong,
    backgroundColor: onAccent
      ? alpha(theme.palette.primary.contrastText, 0.15)
      : 'transparent',
    color: onAccent ? 'inherit' : tokens.textMuted,
    fontFamily: theme.typography.mono.fontFamily,
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.6,
    whiteSpace: 'nowrap',
  };
});
