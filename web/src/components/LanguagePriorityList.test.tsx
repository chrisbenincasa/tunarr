import { renderWithProviders, screen, within } from '@/test/utils';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { LanguagePriorityList } from './LanguagePriorityList.tsx';

// Holds the list in state, as the form does, and records each change.
const ControlledList = ({
  initial,
  onChange,
}: {
  initial: string[];
  onChange: (values: string[]) => void;
}) => {
  const [values, setValues] = useState(initial);
  return (
    <LanguagePriorityList
      values={values}
      onChange={(next) => {
        onChange(next);
        setValues(next);
      }}
      label="Languages"
    />
  );
};

function renderList(values: string[]) {
  const onChange = vi.fn<(values: string[]) => void>();
  const result = renderWithProviders(
    <ControlledList initial={values} onChange={onChange} />,
  );
  return { ...result, onChange };
}

function rowNames() {
  const list = screen.getByRole('list', { name: 'Languages' });
  return within(list)
    .getAllByRole('listitem')
    .map((row) => within(row).getAllByText(/\S/)[1]?.textContent);
}

describe('LanguagePriorityList', () => {
  test('shows languages in saved order, not alphabetically', () => {
    renderList(['spa', 'eng', 'jpn']);

    expect(rowNames()).toEqual(['Spanish', 'English', 'Japanese']);
  });

  test('shows bibliographic and custom codes', () => {
    renderList(['ger', 'qaa']);

    expect(rowNames()).toEqual(['German', 'qaa']);
  });

  test('shows a language saved twice once, and drops the copy on edit', async () => {
    const { user, onChange } = renderList(['eng', 'jpn', 'en']);

    expect(rowNames()).toEqual(['English', 'Japanese']);

    await user.click(screen.getByRole('button', { name: 'Move Japanese up' }));
    expect(onChange).toHaveBeenCalledWith(['jpn', 'eng']);
  });

  test('reorders with the arrow buttons', async () => {
    const { user, onChange } = renderList(['spa', 'eng', 'jpn']);

    expect(
      screen.getByRole('button', { name: 'Move Spanish up' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Move Japanese down' }),
    ).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move Spanish down' }));
    expect(onChange).toHaveBeenLastCalledWith(['eng', 'spa', 'jpn']);

    await user.click(screen.getByRole('button', { name: 'Move Japanese up' }));
    expect(onChange).toHaveBeenLastCalledWith(['eng', 'jpn', 'spa']);
    expect(rowNames()).toEqual(['English', 'Japanese', 'Spanish']);
  });

  test('removes a language', async () => {
    const { user, onChange } = renderList(['spa', 'eng', 'jpn']);

    await user.click(screen.getByRole('button', { name: 'Remove English' }));

    expect(onChange).toHaveBeenCalledWith(['spa', 'jpn']);
  });

  test('adds a picked language to the end and hides chosen ones', async () => {
    const { user, onChange } = renderList(['eng']);
    const input = screen.getByRole('combobox', { name: 'Add language' });

    await user.type(input, 'Engl');
    expect(
      screen.queryByRole('option', { name: /English/ }),
    ).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Fren');
    await user.click(screen.getByRole('option', { name: /French/ }));

    expect(onChange).toHaveBeenCalledWith(['eng', 'fra']);
    expect(input).toHaveValue('');
  });

  test('adds a typed code', async () => {
    const { user, onChange } = renderList(['eng']);
    const input = screen.getByRole('combobox', { name: 'Add language' });

    await user.type(input, 'de{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['eng', 'deu']);

    await user.type(input, 'qaa{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['eng', 'deu', 'qaa']);
  });

  test('explains why typed input was not added', async () => {
    const { user, onChange } = renderList(['eng']);
    const input = screen.getByRole('combobox', { name: 'Add language' });

    await user.type(input, 'en{Enter}');
    expect(
      screen.getByText('English is already in the list'),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'xyzzy{Enter}');
    expect(
      screen.getByText('Enter a language name or a 2- or 3-letter code'),
    ).toBeInTheDocument();

    expect(onChange).not.toHaveBeenCalled();
  });
});
