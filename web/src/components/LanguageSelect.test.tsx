import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, test, vi } from 'vitest';
import { LanguageSelect } from './LanguageSelect.tsx';

function renderSelect(value: string) {
  const onChange = vi.fn<(code: string) => void>();
  const result = renderWithProviders(
    <LanguageSelect value={value} onChange={onChange} />,
  );
  return { ...result, onChange };
}

const field = () => screen.getByRole('combobox', { name: 'Language' });

describe('LanguageSelect', () => {
  test('starts empty with no value', () => {
    renderSelect('');

    expect(field()).toHaveValue('');
  });

  test('names a 2-letter or bibliographic code', () => {
    const { rerender } = renderSelect('ger');
    expect(field()).toHaveValue('German');

    rerender(<LanguageSelect value="fr" onChange={vi.fn()} />);
    expect(field()).toHaveValue('French');
  });

  test('shows a code with no matching language as typed, without warnings', () => {
    const warn = vi.spyOn(console, 'warn');
    renderSelect('qaa');

    expect(field()).toHaveValue('qaa');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('reports an empty value when cleared', async () => {
    const { user, onChange } = renderSelect('jpn');

    await user.clear(field());

    expect(onChange).toHaveBeenCalledWith('');
  });
});
