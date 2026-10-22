import { Trans, useLingui } from '@lingui/react/macro';
import { Search } from '@mui/icons-material';
import {
  Box,
  ButtonBase,
  Dialog,
  InputBase,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  type KeyboardEvent,
  useCallback,
  useId,
  useMemo,
  useState,
} from 'react';
import type { PaletteGroup, PaletteItem } from './paletteModel.ts';

export type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  groups: PaletteGroup[];
  onSelect: (item: PaletteItem) => void;
  onSearchLibrary: (query: string) => void;

  // Shown in place of results while entity lists load.
  loading?: boolean;
};

const Kbd = ({ children }: { children: string }) => (
  <Box component="kbd" sx={{ fontSize: 12 }}>
    {children}
  </Box>
);

export const CommandPalette = ({
  open,
  onClose,
  query,
  onQueryChange,
  groups,
  onSelect,
  onSearchLibrary,
  loading = false,
}: CommandPaletteProps) => {
  const { t } = useLingui();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const idPrefix = useId();
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const searchable = query.trim().length > 0;
  const rowCount = items.length + (searchable ? 1 : 0);
  const active = rowCount === 0 ? -1 : Math.min(activeIndex, rowCount - 1);
  const rowId = useCallback(
    (index: number) => `${idPrefix}-row-${index}`,
    [idPrefix],
  );

  const choose = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        onSelect(item);
      } else if (searchable && index === items.length) {
        onSearchLibrary(query.trim());
      }
    },
    [items, searchable, query, onSelect, onSearchLibrary],
  );

  const move = useCallback(
    (delta: number) => {
      if (rowCount === 0) {
        return;
      }
      const next = (active + delta + rowCount) % rowCount;
      setActiveIndex(next);
      document
        .getElementById(rowId(next))
        ?.scrollIntoView({ block: 'nearest' });
    },
    [active, rowCount, rowId],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        move(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        choose(active);
      }
    },
    [active, move, choose],
  );

  const rowSx = (index: number) => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minHeight: 44,
    px: '10px',
    borderRadius: '10px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    textAlign: 'left',
    justifyContent: 'flex-start',
    bgcolor: index === active ? 'tokens.accentSoft' : 'transparent',
  });

  let index = -1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      slotProps={{
        paper: {
          'aria-label': t`Search or jump to`,
          sx: {
            width: '100%',
            maxWidth: 640,
            m: phone ? '12px 8px 0' : '96px 16px 0',
            borderRadius: '16px',
            borderColor: 'tokens.borderStrong',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          height: 56,
          px: '16px',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
        <InputBase
          autoFocus
          fullWidth
          value={query}
          placeholder={t`Search or jump to…`}
          onChange={(e) => {
            setActiveIndex(0);
            onQueryChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          inputProps={{
            role: 'combobox',
            'aria-label': t`Search or jump to`,
            'aria-expanded': true,
            'aria-controls': `${idPrefix}-list`,
            'aria-activedescendant': active >= 0 ? rowId(active) : undefined,
            spellCheck: false,
          }}
          sx={{ fontSize: 16 }}
        />
        <ButtonBase
          onClick={onClose}
          aria-label={t`Esc, close search`}
          sx={(theme) => ({
            flex: 'none',
            height: 28,
            px: '8px',
            borderRadius: '6px',
            border: `1px solid ${theme.palette.tokens.borderStrong}`,
            bgcolor: 'tokens.surfaceRaised',
            color: 'text.secondary',
            fontFamily: theme.typography.mono.fontFamily,
            fontSize: 11,
          })}
        >
          Esc
        </ButtonBase>
      </Box>

      <Box id={`${idPrefix}-list`} role="listbox" aria-label={t`Results`}>
        <Box
          role="presentation"
          sx={{
            p: '8px',
            maxHeight: 360,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {loading && items.length === 0 ? (
            <Box sx={{ p: '10px', color: 'text.secondary' }}>
              <Trans>Loading…</Trans>
            </Box>
          ) : items.length === 0 ? (
            <Box sx={{ p: '10px', color: 'text.secondary' }}>
              <Trans>No pages or lists match.</Trans>
            </Box>
          ) : (
            groups.map((group) => (
              <Box key={group.name} role="group" aria-label={group.name}>
                <Box
                  aria-hidden
                  sx={{
                    p: '10px 10px 4px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {group.name}
                </Box>
                {group.items.map((item) => {
                  index++;
                  const rowIndex = index;
                  return (
                    <ButtonBase
                      key={item.id}
                      id={rowId(rowIndex)}
                      role="option"
                      tabIndex={-1}
                      aria-selected={rowIndex === active}
                      onMouseMove={() =>
                        rowIndex !== active && setActiveIndex(rowIndex)
                      }
                      onClick={() => choose(rowIndex)}
                      sx={rowSx(rowIndex)}
                    >
                      <Box
                        component="span"
                        sx={(theme) => ({
                          flex: 'none',
                          minWidth: '4ch',
                          fontFamily: theme.typography.mono.fontFamily,
                          color: 'text.secondary',
                        })}
                      >
                        {item.number}
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </Box>
                      <Box
                        component="span"
                        sx={{ fontSize: 12, color: 'text.secondary' }}
                      >
                        {item.kind}
                      </Box>
                    </ButtonBase>
                  );
                })}
              </Box>
            ))
          )}
        </Box>

        {searchable && (
          <Box
            role="presentation"
            sx={{ p: '8px', borderTop: 1, borderColor: 'divider' }}
          >
            <ButtonBase
              id={rowId(items.length)}
              role="option"
              tabIndex={-1}
              aria-selected={active === items.length}
              onMouseMove={() =>
                active !== items.length && setActiveIndex(items.length)
              }
              onClick={() => choose(items.length)}
              sx={[
                rowSx(items.length),
                { color: 'tokens.accent', fontWeight: 600 },
              ]}
            >
              <Search sx={{ fontSize: 16 }} />
              <Box
                component="span"
                sx={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Trans>Search library for “{query.trim()}”</Trans>
              </Box>
              <Box
                component="span"
                sx={{
                  ml: 'auto',
                  flex: 'none',
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'text.secondary',
                }}
              >
                <Trans>Opens Search</Trans>
              </Box>
            </ButtonBase>
          </Box>
        )}
      </Box>

      {!phone && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            px: '16px',
            py: '10px',
            borderTop: 1,
            borderColor: 'divider',
            fontSize: 12,
            color: 'text.secondary',
          }}
        >
          <span>
            <Kbd>&uarr;</Kbd> <Kbd>&darr;</Kbd> <Trans>move</Trans>
          </span>
          <span>
            <Kbd>Enter</Kbd> <Trans>open</Trans>
          </span>
          <span>
            <Kbd>Esc</Kbd> <Trans>close</Trans>
          </span>
        </Box>
      )}
    </Dialog>
  );
};
