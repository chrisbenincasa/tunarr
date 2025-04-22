import { Delete } from '@mui/icons-material';
import { Checkbox, IconButton, Link, Stack, Tooltip } from '@mui/material';
import type { SubtitleFilter, SubtitlePreference } from '@tunarr/types';
import { SubtitleFilterSchema } from '@tunarr/types/schemas';
import { capitalize, isUndefined } from 'lodash-es';
import type { MRT_ColumnDef } from 'material-react-table';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useMemo } from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import { languageBy3LetterCode } from '../../helpers/language.ts';
import { useChannelFormContext } from '../../hooks/useChannelFormContext.ts';
import { LanguageAutocomplete } from '../LanguageAutocomplete.tsx';

export const ChannelSubtitlePreferencesTable = () => {
  const { watch, control, setValue } = useChannelFormContext();
  const prefFields = useFieldArray({ control, name: 'subtitlePreferences' });
  const prefs = watch('subtitlePreferences');

  const columns = useMemo<MRT_ColumnDef<SubtitlePreference>[]>(() => {
    return [
      {
        header: 'Priority',
        accessorKey: 'priority',
        Cell({ cell }) {
          return cell.getValue<number>() + 1;
        },
        enableEditing: false,
      },
      {
        header: 'Language',
        id: 'langugeCode',
        accessorFn(originalRow) {
          return languageBy3LetterCode[originalRow.langugeCode];
        },
        enableEditing: false,
      },
      {
        header: 'Allow External',
        accessorKey: 'allowExternal',
        enableEditing: false,
        Cell({ row, cell }) {
          const name =
            `subtitlePreferences.${row.index}.allowExternal` as const;
          const value = cell.getValue<boolean>();
          return (
            <Checkbox
              sx={{ p: 0 }}
              checked={value}
              onChange={(_, checked) => setValue(name, checked)}
            />
          );
        },
      },
      {
        header: 'Allow Image Based',
        accessorKey: 'allowImageBased',
        enableEditing: false,
        Cell({ row, cell }) {
          const name =
            `subtitlePreferences.${row.index}.allowImageBased` as const;
          const value = cell.getValue<boolean>();
          return (
            <Checkbox
              sx={{ p: 0 }}
              onChange={(_, checked) => setValue(name, checked)}
              checked={value}
            />
          );
        },
      },
      {
        header: 'Filter Type',
        Header: () => {
          return (
            <>
              Filter&nbsp;
              <Tooltip
                title={
                  <>
                    Filter which subtitle tracks are considered
                    <br />
                    <strong>Any: </strong> All subtitle tracks are considered{' '}
                    <br />
                    <strong>Forced: </strong>Only consider{' '}
                    <Link
                      href="https://partnerhelp.netflixstudios.com/hc/en-us/articles/224198488-What-is-a-Forced-Narrative-subtitle"
                      target="_blank"
                    >
                      "forced"
                    </Link>
                    subtitle tracks <br />
                    <strong>Default: </strong>Only consider default subtitle
                    tracks <br />
                    <strong>None: </strong> Do not select any subtitles
                  </>
                }
                placement="top"
              >
                <span>[?]</span>
              </Tooltip>
            </>
          );
        },
        Cell: ({ cell }) => capitalize(cell.getValue<string>()),
        accessorKey: 'filter',
        editVariant: 'select',
        editSelectOptions: SubtitleFilterSchema.options.map((opt) => ({
          label: capitalize(opt),
          value: opt,
        })),
        muiEditTextFieldProps: ({ row }) => ({
          select: true,
          onChange: (ev) =>
            setValue(
              `subtitlePreferences.${row.index}.filter`,
              ev.target.value as SubtitleFilter,
            ),
        }),
      },
    ];
  }, [setValue]);

  const renderLanguageAutoComplete = () => {
    return (
      <LanguageAutocomplete
        values={[]}
        showValues={false}
        sx={{ width: '50%' }}
        onSelect={(opt) =>
          prefFields.append({
            langugeCode: opt.iso6392,
            priority: prefFields.fields.length,
            allowExternal: true,
            allowImageBased: true,
            filter: 'any',
          })
        }
        onRemove={() => {}}
        textFieldProps={{
          label: 'Add Language Preference',
        }}
      />
    );
  };

  const table = useMaterialReactTable({
    data: (prefs ?? []).map((pref, idx) => ({ ...pref, priority: idx })),
    columns,
    enableRowDragging: false,
    enableSorting: false,
    autoResetPageIndex: false,
    enableRowOrdering: true,
    enableRowActions: true,
    enableEditing: true,
    editDisplayMode: 'cell',
    positionActionsColumn: 'last',
    displayColumnDefOptions: {
      'mrt-row-actions': {
        // size: mediumViewport ? 60 : 100,
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    renderRowActions: ({ row }) => {
      return (
        <Stack direction="row">
          <IconButton onClick={() => prefFields.remove(row.index)} size="small">
            <Delete />
          </IconButton>
        </Stack>
      );
    },
    renderTopToolbarCustomActions: () => {
      return (
        <Controller
          control={control}
          name="subtitlePreferences"
          render={renderLanguageAutoComplete}
        />
      );
    },
    muiRowDragHandleProps: ({ table }) => ({
      onDragEnd: () => {
        const { draggingRow, hoveredRow } = table.getState();
        if (hoveredRow && draggingRow && !isUndefined(hoveredRow.index)) {
          prefFields.swap(hoveredRow.index, draggingRow.index);
        }
      },
    }),
  });

  return <MaterialReactTable table={table} />;
};
