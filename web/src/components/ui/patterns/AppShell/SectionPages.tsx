import { Box, type Theme } from '@mui/material';
import { radiusPill } from '../../../../themeTokens.ts';
import type { ShellNavSection } from './navModel.ts';
import { LinkButtonBase } from './shellLinks.ts';

export type SectionPagesProps = {
  section: ShellNavSection;
  activePageId?: string;
  variant: 'tabs' | 'chips';
};

const tabSx = (current: boolean) => (theme: Theme) => ({
  flex: 'none',
  height: theme.sizes.subTabHeight,
  px: '12px',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: current ? 600 : 500,
  color: current ? theme.palette.text.primary : theme.palette.text.secondary,
  borderBottom: `2px solid ${current ? theme.palette.tokens.accent : 'transparent'}`,
  '&:hover': { color: theme.palette.text.primary },
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette.tokens.accent}`,
    outlineOffset: -2,
  },
});

const chipSx = (current: boolean) => (theme: Theme) => {
  const t = theme.palette.tokens;
  return {
    flex: 'none',
    height: 36,
    px: '14px',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: current ? 600 : 500,
    borderRadius: `${radiusPill}px`,
    border: `1px solid ${current ? 'transparent' : t.borderStrong}`,
    bgcolor: current ? t.accentSoft : 'transparent',
    color: current ? t.accent : theme.palette.text.secondary,
    '&.Mui-focusVisible': { outline: `2px solid ${t.accent}` },
  };
};

// The pages of one section, as underline tabs under the desktop bar or as a
// scrolling chip row under the phone header.
export const SectionPages = ({
  section,
  activePageId,
  variant,
}: SectionPagesProps) => (
  <Box
    component="nav"
    aria-label={section.label}
    sx={(theme) => ({
      display: 'flex',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      ...(variant === 'tabs'
        ? {
            gap: '4px',
            px: `${theme.sizes.shellPaddingX - 6}px`,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }
        : {
            gap: '6px',
            px: '16px',
            py: '10px',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
    })}
  >
    {section.pages.map((page) => {
      const current = page.id === activePageId;
      return (
        <LinkButtonBase
          key={page.id}
          to={page.to}
          aria-current={current ? 'page' : undefined}
          sx={variant === 'tabs' ? tabSx(current) : chipSx(current)}
        >
          {page.label}
        </LinkButtonBase>
      );
    })}
  </Box>
);
