import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, test, vi } from 'vitest';
import { ConditionClauseEditor } from './ConditionClauseEditor.tsx';
import type { ConditionClause } from './types.ts';

function renderClause(clause: ConditionClause) {
  const onChange = vi.fn<(clause: ConditionClause) => void>();
  const result = renderWithProviders(
    <ConditionClauseEditor
      clause={clause}
      onChange={onChange}
      onRemove={vi.fn()}
      canRemove
    />,
  );
  return { ...result, onChange };
}

const languageField = () => screen.getByRole('combobox', { name: 'Language' });

describe('ConditionClauseEditor', () => {
  test('shows the chosen audio language', () => {
    renderClause({ type: 'audio_language', operator: 'in', value: 'jpn' });

    expect(languageField()).toHaveValue('Japanese');
  });

  test('shows the chosen subtitle language', () => {
    renderClause({ type: 'subtitle_language', operator: 'in', value: 'eng' });

    expect(languageField()).toHaveValue('English');
  });

  test('reports a newly picked language', async () => {
    const { user, onChange } = renderClause({
      type: 'audio_language',
      operator: 'not_in',
      value: 'jpn',
    });

    await user.clear(languageField());
    await user.type(languageField(), 'Fren');
    await user.click(screen.getByRole('option', { name: 'French' }));

    expect(onChange).toHaveBeenLastCalledWith({
      type: 'audio_language',
      operator: 'not_in',
      value: 'fra',
    });
  });
});
