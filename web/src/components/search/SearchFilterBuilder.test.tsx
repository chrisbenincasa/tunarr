import { renderWithProviders, screen } from '@/test/utils';
import { search } from '@tunarr/shared/util';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, test, vi } from 'vitest';
import { parseSearchQuery } from '../../hooks/useSearchQueryParser.ts';
import { SearchFilterBuilder } from './SearchFilterBuilder.tsx';
import type { SearchForm } from './SearchInput.tsx';

function Harness({ onSubmit }: { onSubmit: (form: SearchForm) => void }) {
  const methods = useForm<SearchForm>({
    defaultValues: {
      keywords: '',
      filter: { type: 'text', expression: '' },
      queryBuilderType: 'text',
    },
  });
  return (
    <form onSubmit={methods.handleSubmit(onSubmit)}>
      <FormProvider {...methods}>
        <SearchFilterBuilder />
      </FormProvider>
    </form>
  );
}

function getFilterBox() {
  return screen.getByRole('textbox', { name: 'Filter' });
}

describe('SearchFilterBuilder', () => {
  test('the filter box is a multi-line text area', () => {
    renderWithProviders(<Harness onSubmit={vi.fn()} />);

    expect(getFilterBox().tagName).toBe('TEXTAREA');
  });

  test('Shift+Enter adds a line and the multi-line query still parses', async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(<Harness onSubmit={onSubmit} />);

    await user.type(
      getFilterBox(),
      'type = "movie"{Shift>}{Enter}{/Shift}\tAND title !~ "Scooby"',
    );

    const expression = 'type = "movie"\n\tAND title !~ "Scooby"';
    expect(getFilterBox()).toHaveValue(expression);
    expect(onSubmit).not.toHaveBeenCalled();

    const multiLine = parseSearchQuery(expression);
    const singleLine = parseSearchQuery('type = "movie" AND title !~ "Scooby"');
    if (multiLine?.type !== 'success' || singleLine?.type !== 'success') {
      throw new Error('expected both expressions to parse');
    }
    expect(search.parsedSearchToRequest(multiLine.query)).toEqual(
      search.parsedSearchToRequest(singleLine.query),
    );
  });

  test('Enter submits the search without adding a line', async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(<Harness onSubmit={onSubmit} />);

    await user.type(getFilterBox(), 'type = "movie"{Enter}');

    expect(getFilterBox()).toHaveValue('type = "movie"');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      filter: { type: 'text', expression: 'type = "movie"' },
    });
  });
});
