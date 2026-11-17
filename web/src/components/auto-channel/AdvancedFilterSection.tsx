import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Typography,
} from '@mui/material';
import type { MediaSourceId } from '@tunarr/shared';
import { search } from '@tunarr/shared/util';
import { isEmpty } from 'lodash-es';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useSearchQueryParser } from '../../hooks/useSearchQueryParser.ts';
import { SearchFilterBuilder } from '../search/SearchFilterBuilder.tsx';
import type { SearchForm } from '../search/SearchInput.tsx';

type Props = {
  filterString: string;
  onFilterStringChange: (value: string) => void;
  mediaSourceId?: MediaSourceId;
  libraryId?: string;
};

export function AdvancedFilterSection({
  filterString,
  onFilterStringChange,
  mediaSourceId,
  libraryId,
}: Props) {
  const formMethods = useForm<SearchForm>({
    defaultValues: {
      keywords: '',
      filter: { type: 'text', expression: filterString },
      queryBuilderType: 'text',
    },
    mode: 'onChange',
  });
  const { getSearchExpression } = useSearchQueryParser();

  // Emit only valid filters, so a half-typed expression keeps the last good preview.
  useEffect(() => {
    const subscription = formMethods.watch(() => {
      const filter = formMethods.getValues('filter');
      let next: string;
      if (filter.type === 'structured') {
        next = search.searchFilterToString(filter.filter);
      } else if (isEmpty(filter.expression)) {
        next = '';
      } else if (getSearchExpression(filter.expression)?.type === 'success') {
        next = filter.expression;
      } else {
        return;
      }

      if (next !== filterString) {
        onFilterStringChange(next);
      }
    });
    return () => subscription.unsubscribe();
  }, [formMethods, getSearchExpression, filterString, onFilterStringChange]);

  return (
    <Accordion disableGutters sx={{ mt: 2, '&::before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2">Advanced Filter</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Alert severity="info" sx={{ mb: 2 }}>
          Advanced filters combine with the selections above using AND logic.
          Content must match both your picker selections and this filter.
        </Alert>
        <FormProvider {...formMethods}>
          <SearchFilterBuilder
            mediaSourceId={mediaSourceId}
            libraryId={libraryId}
          />
        </FormProvider>
      </AccordionDetails>
    </Accordion>
  );
}
