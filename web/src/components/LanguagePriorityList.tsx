import { useLingui } from '@lingui/react/macro';
import {
  Close,
  DragIndicator,
  KeyboardArrowDown,
  KeyboardArrowUp,
} from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import type { LanguagePreference } from '@tunarr/types';
import { uniqBy } from 'lodash-es';
import type { HTMLAttributes } from 'react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import {
  filterLanguageOptions,
  languageDisplayName,
  languageKey,
  parseLanguageInput,
} from '../helpers/language.ts';
import { moveItem, moveOnDragOver } from '../helpers/util.ts';
import { languageOptions } from '../hooks/useLanguagePreferences.ts';

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
  helperText?: string;
  error?: boolean;
};

type DragItem = {
  code: string;
  originalIndex: number;
};

/**
 * An ordered list of language codes. Rows reorder by dragging or with the
 * arrow buttons, and the box below adds a language by name or by code.
 */
export const LanguagePriorityList = ({
  values,
  onChange,
  label,
  helperText,
  error,
}: Props) => {
  const { t } = useLingui();
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string>();

  // Each list gets its own drag type, so a row can't land in another rule's list.
  const dragType = useId();

  // Older versions could save the same language twice. Show it once, and
  // write the cleaned list back on the next edit.
  const items = useMemo(() => uniqBy(values, languageKey), [values]);

  // Drag events can fire again before the form re-renders. Moves read and
  // write this ref, so a second event sees the order the first one produced.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const update = useCallback(
    (next: string[]) => {
      itemsRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const moveTo = useCallback(
    (code: string, to: number) => {
      const current = itemsRef.current;
      const from = current.indexOf(code);
      if (from >= 0 && to >= 0 && to < current.length && from !== to) {
        update(moveItem(current, from, to));
      }
    },
    [update],
  );

  const moveBy = useCallback(
    (code: string, offset: number) =>
      moveTo(code, itemsRef.current.indexOf(code) + offset),
    [moveTo],
  );

  const dragOver = useCallback(
    (code: string, overCode: string, pointerInUpperHalf: boolean) => {
      const next = moveOnDragOver(
        itemsRef.current,
        code,
        overCode,
        pointerInUpperHalf,
      );
      if (next) {
        update(next);
      }
    },
    [update],
  );

  const remove = useCallback(
    (code: string) => update(itemsRef.current.filter((c) => c !== code)),
    [update],
  );

  const options = useMemo(() => {
    const chosen = new Set(items.map(languageKey));
    return languageOptions.filter((opt) => !chosen.has(opt.iso6392));
  }, [items]);

  const add = (code: string) => {
    const key = languageKey(code);
    if (items.some((item) => languageKey(item) === key)) {
      const name = languageDisplayName(code) ?? code;
      setInputError(t`${name} is already in the list`);
      return;
    }
    update([...items, code]);
    setInput('');
    setInputError(undefined);
  };

  const listLabelId = `${dragType}-label`;

  return (
    <Box>
      <Typography
        id={listLabelId}
        variant="caption"
        color={error ? 'error' : 'text.secondary'}
        component="div"
        sx={{ mb: 0.5 }}
      >
        {label}
      </Typography>
      {items.length > 0 && (
        <Paper
          variant="outlined"
          component="ol"
          aria-labelledby={listLabelId}
          sx={{ listStyle: 'none', m: 0, mb: 1.5, p: 0 }}
        >
          {items.map((code, index) => (
            <LanguagePriorityRow
              key={code}
              code={code}
              index={index}
              count={items.length}
              dragType={dragType}
              onMoveTo={moveTo}
              onMoveBy={moveBy}
              onDragOver={dragOver}
              onRemove={remove}
            />
          ))}
        </Paper>
      )}
      <Autocomplete<LanguagePreference, false, false, true>
        freeSolo
        autoHighlight
        options={options}
        value={null}
        inputValue={input}
        onInputChange={(_, value, reason) => {
          setInput(reason === 'reset' ? '' : value);
          setInputError(undefined);
        }}
        onChange={(_, value) => {
          if (value === null) {
            return;
          }
          if (typeof value !== 'string') {
            add(value.iso6392);
            return;
          }
          const code = parseLanguageInput(value);
          if (code) {
            add(code);
          } else {
            setInputError(t`Enter a language name or a 2- or 3-letter code`);
          }
        }}
        filterOptions={(opts, { inputValue }) =>
          filterLanguageOptions(opts, inputValue)
        }
        getOptionLabel={(opt) =>
          typeof opt === 'string' ? opt : opt.displayName
        }
        renderOption={(
          { key, ...props }: HTMLAttributes<HTMLLIElement> & { key: string },
          opt,
        ) => (
          <li key={key} {...props}>
            <Box sx={{ flex: 1 }}>{opt.displayName}</Box>
            <Typography variant="caption" color="text.secondary">
              {opt.iso6392}
            </Typography>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t`Add language`}
            size="small"
            error={error || !!inputError}
            helperText={inputError ?? helperText}
          />
        )}
      />
    </Box>
  );
};

type RowProps = {
  code: string;
  index: number;
  count: number;
  dragType: string;
  onMoveTo: (code: string, to: number) => void;
  onMoveBy: (code: string, offset: number) => void;
  onDragOver: (
    code: string,
    overCode: string,
    pointerInUpperHalf: boolean,
  ) => void;
  onRemove: (code: string) => void;
};

const LanguagePriorityRow = ({
  code,
  index,
  count,
  dragType,
  onMoveTo,
  onMoveBy,
  onDragOver,
  onRemove,
}: RowProps) => {
  const { t } = useLingui();
  const handleRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  const name = languageDisplayName(code);
  const label = name ?? code;

  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: dragType,
      item: (): DragItem => ({ code, originalIndex: index }),
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      end: (item, monitor) => {
        if (!monitor.didDrop()) {
          onMoveTo(item.code, item.originalIndex);
        }
      },
    }),
    [dragType, code, index, onMoveTo],
  );

  const [, drop] = useDrop<DragItem>(
    () => ({
      accept: dragType,
      hover: (item, monitor) => {
        const pointer = monitor.getClientOffset();
        if (item.code === code || !rowRef.current || !pointer) {
          return;
        }
        const { top, height } = rowRef.current.getBoundingClientRect();
        onDragOver(item.code, code, pointer.y < top + height / 2);
      },
    }),
    [dragType, code, onDragOver],
  );

  drag(handleRef);
  drop(preview(rowRef));

  return (
    <Box
      component="li"
      ref={rowRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 1,
        pr: 0.5,
        py: 0.25,
        opacity: isDragging ? 0.4 : 1,
        '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' },
      }}
    >
      <Box
        ref={handleRef}
        aria-hidden
        sx={{ display: 'flex', color: 'text.secondary', cursor: 'grab' }}
      >
        <DragIndicator fontSize="small" />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 16 }}>
        {index + 1}
      </Typography>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {label}
      </Typography>
      {name && (
        <Typography variant="caption" color="text.secondary">
          {code}
        </Typography>
      )}
      <IconButton
        aria-label={t`Move ${label} up`}
        size="small"
        disabled={index === 0}
        onClick={() => onMoveBy(code, -1)}
      >
        <KeyboardArrowUp fontSize="small" />
      </IconButton>
      <IconButton
        aria-label={t`Move ${label} down`}
        size="small"
        disabled={index === count - 1}
        onClick={() => onMoveBy(code, 1)}
      >
        <KeyboardArrowDown fontSize="small" />
      </IconButton>
      <IconButton
        aria-label={t`Remove ${label}`}
        size="small"
        onClick={() => onRemove(code)}
      >
        <Close fontSize="small" />
      </IconButton>
    </Box>
  );
};
