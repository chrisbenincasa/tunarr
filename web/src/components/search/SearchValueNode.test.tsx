import { renderWithProviders, screen, within } from '@/test/utils';
import type { UserEvent } from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, test } from 'vitest';
import type { SearchForm } from './SearchInput.tsx';
import { SearchValueNode } from './SearchValueNode.tsx';

function Harness() {
  const methods = useForm<SearchForm>({
    defaultValues: {
      keywords: '',
      queryBuilderType: 'click',
      filter: {
        type: 'structured',
        filter: {
          type: 'op',
          op: 'and',
          children: [
            {
              type: 'value',
              fieldSpec: { key: 'title', type: 'string', op: '=', value: [] },
            },
          ],
        },
      },
    },
  });
  return (
    <FormProvider {...methods}>
      <SearchValueNode
        formKey="filter.filter.children.0"
        index={0}
        depth={0}
        only
        remove={() => {}}
      />
    </FormProvider>
  );
}

function fieldSelect() {
  return screen.getAllByRole('combobox')[0];
}

function operatorSelect() {
  return screen.getAllByRole('combobox')[1];
}

async function choose(
  user: UserEvent,
  select: HTMLElement | undefined,
  option: string,
) {
  if (!select) {
    throw new Error('select not rendered');
  }
  await user.click(select);
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByRole('option', { name: option }));
}

describe('SearchValueNode operator dropdown', () => {
  test('shows the chosen operator before any Field change', async () => {
    const { user } = renderWithProviders(<Harness />);

    await choose(user, operatorSelect(), 'contains');

    expect(operatorSelect()).toHaveTextContent('contains');
  });

  test('shows the chosen operator after the Field changes', async () => {
    const { user } = renderWithProviders(<Harness />);

    await choose(user, fieldSelect(), 'Show Title');
    expect(fieldSelect()).toHaveTextContent('Show Title');

    await choose(user, operatorSelect(), 'contains');
    expect(operatorSelect()).toHaveTextContent('contains');

    await choose(user, operatorSelect(), 'starts with');
    expect(operatorSelect()).toHaveTextContent('starts with');
  });

  test('a Field change resets the shown operator to =', async () => {
    const { user } = renderWithProviders(<Harness />);

    await choose(user, operatorSelect(), 'contains');
    await choose(user, fieldSelect(), 'Show Title');

    expect(operatorSelect()).toHaveTextContent('=');
    expect(operatorSelect()).not.toHaveTextContent('contains');
  });
});
