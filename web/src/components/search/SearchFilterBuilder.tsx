import { Clear, Help } from '@mui/icons-material';
import {
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import type { MediaSourceId } from '@tunarr/shared';
import type { SearchRequest } from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import { isEmpty, isNil } from 'lodash-es';
import { useCallback } from 'react';
import type { FieldPathValue, Validate } from 'react-hook-form';
import { Controller, useFormContext } from 'react-hook-form';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useSearchQueryParser } from '../../hooks/useSearchQueryParser.ts';
import { CreateSmartCollectionDialog } from '../smart_collections/CreateSmartCollectionDialog.tsx';
import { PointAndClickSearchBuilder } from './PointAndClickSearchBuilder.tsx';
import type { SearchForm } from './SearchInput.tsx';
import { SearchInputToggle } from './SearchInputToggle.tsx';

type SearchBuilderProps = {
  onSearch: (query: SearchRequest) => void;
  mediaSourceId?: MediaSourceId;
  libraryId?: string;
};

export function SearchFilterBuilder({
  libraryId,
  mediaSourceId,
}: SearchBuilderProps) {
  const [smartCollectionModalOpen, toggleSmartCollectionModal] =
    useToggle(false);

  const formMethods = useFormContext<SearchForm>();

  const { getSearchExpression } = useSearchQueryParser();
  const [query, queryBuilderType] = formMethods.watch([
    'filter',
    'queryBuilderType',
  ]);

  const validateFilterExpression: Validate<
    FieldPathValue<SearchForm, 'filter.expression'>,
    SearchForm
  > = useCallback(
    (value) => {
      if (isNil(value) || isEmpty(value)) {
        return true;
      }
      const expr = getSearchExpression(value);
      if (!expr || expr.type === 'error') {
        return false;
      }
      return true;
    },
    [getSearchExpression],
  );

  return (
    <>
      <Stack gap={2}>
        {queryBuilderType === 'text' ? (
          <Stack direction="row" gap={2} alignItems={'center'}>
            <Controller
              name="filter.expression"
              control={formMethods.control}
              rules={{
                validate: {
                  validExpression: validateFilterExpression,
                },
              }}
              render={({ field, fieldState }) => {
                console.log(field);
                return (
                  <>
                    <TextField
                      label="Filter"
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.type === 'validExpression' ? (
                          <span>
                            Could not parse this filter expression. Check the{' '}
                            <Link
                              href="https://tunarr.com/misc/search"
                              target="_blank"
                            >
                              documentation
                            </Link>{' '}
                            for information about filter expressions.
                          </span>
                        ) : (
                          <span> </span>
                        )
                      }
                      slotProps={{
                        input: {
                          spellCheck: false,
                          endAdornment: (
                            <>
                              {isNonEmptyString(field.value) && (
                                <InputAdornment position="end">
                                  <IconButton
                                    onClick={() => field.onChange('')}
                                  >
                                    <Clear />
                                  </IconButton>
                                </InputAdornment>
                              )}
                              <InputAdornment position="end">
                                <Tooltip
                                  title="Add a filter expression to fine-tune results of the search"
                                  placement="top"
                                  sx={{ textAlign: 'center' }}
                                  slotProps={{
                                    popper: {
                                      sx: {
                                        textAlign: 'center',
                                      },
                                    },
                                  }}
                                >
                                  <IconButton>
                                    <Help />
                                  </IconButton>
                                </Tooltip>
                              </InputAdornment>
                            </>
                          ),
                        },
                      }}
                      fullWidth
                      {...field}
                    />
                    <FormControl sx={{ minWidth: '96px' }}>
                      <SearchInputToggle />
                      <FormHelperText>
                        {fieldState.error?.type === 'validExpression' ? (
                          ' '
                        ) : (
                          <span> </span>
                        )}
                      </FormHelperText>
                    </FormControl>
                  </>
                );
              }}
            />
          </Stack>
        ) : (
          <PointAndClickSearchBuilder
            mediaSourceId={mediaSourceId}
            libraryId={libraryId}
          />
        )}
      </Stack>
      <CreateSmartCollectionDialog
        open={smartCollectionModalOpen}
        onClose={() => toggleSmartCollectionModal(false)}
        initialQuery={query.type === 'text' ? query.expression : ''}
      />
    </>
  );
}
