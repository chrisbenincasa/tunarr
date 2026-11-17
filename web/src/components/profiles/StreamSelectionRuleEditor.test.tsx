import { renderWithProviders, screen, within } from '@/test/utils';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, test, vi } from 'vitest';
import type {
  StreamSelectionProfileFormValues,
  StreamSelectionRuleFormValues,
} from './streamSelectionFormTypes.ts';
import { StreamSelectionRuleEditor } from './StreamSelectionRuleEditor.tsx';

const rule = (
  overrides: Partial<StreamSelectionRuleFormValues> = {},
): StreamSelectionRuleFormValues => ({
  label: '',
  condition: 'true',
  audioAction: { type: 'default' },
  subtitleAction: { type: 'disable' },
  ...overrides,
});

const Form = ({
  rules,
  children,
}: {
  rules: StreamSelectionRuleFormValues[];
  children: ReactNode;
}) => {
  const methods = useForm<StreamSelectionProfileFormValues>({
    defaultValues: { name: 'Profile', rules },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

function renderEditor(
  opts: {
    rules?: StreamSelectionRuleFormValues[];
    index?: number;
    expanded?: boolean;
    readOnly?: boolean;
  } = {},
) {
  const rules = opts.rules ?? [rule()];
  const callbacks = {
    onToggleExpand: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onRemove: vi.fn(),
    onValidateCondition: vi.fn(() => Promise.resolve(undefined)),
  };
  const result = renderWithProviders(
    <Form rules={rules}>
      <StreamSelectionRuleEditor
        index={opts.index ?? 0}
        totalRules={rules.length}
        expanded={opts.expanded ?? false}
        readOnly={opts.readOnly}
        {...callbacks}
      />
    </Form>,
  );
  return { ...result, ...callbacks };
}

describe('StreamSelectionRuleEditor', () => {
  test('summarizes a collapsed rule', () => {
    renderEditor({
      rules: [
        rule({
          label: 'Anime',
          condition: 'program.genres.contains("Anime")',
          audioAction: { type: 'by_language', languages: ['jpn'] },
          subtitleAction: { type: 'default' },
        }),
      ],
    });

    const summary = within(screen.getByRole('button', { expanded: false }));
    expect(summary.getByText('Rule 1')).toBeInTheDocument();
    expect(summary.getByText('Anime')).toBeInTheDocument();
    expect(
      summary.getByText('program.genres.contains("Anime")'),
    ).toBeInTheDocument();
    expect(summary.getByText('Audio:By Language')).toBeInTheDocument();
    expect(summary.getByText('Subs:Default')).toBeInTheDocument();
  });

  test('disables moves and removal at the ends of the list', () => {
    renderEditor({ rules: [rule()] });

    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove rule' })).toBeDisabled();
  });

  test('moves and removes a rule in the middle of the list', async () => {
    const { user, onMoveUp, onMoveDown, onRemove, onToggleExpand } =
      renderEditor({ rules: [rule(), rule(), rule()], index: 1 });

    await user.click(screen.getByRole('button', { name: 'Move up' }));
    await user.click(screen.getByRole('button', { name: 'Move down' }));
    await user.click(screen.getByRole('button', { name: 'Remove rule' }));

    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(onMoveDown).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  test('shows the language fields once subtitles select by language', async () => {
    const { user } = renderEditor({ expanded: true });
    expect(screen.queryByLabelText('Filter')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('combobox', { name: 'Subtitle Strategy' }),
    );
    await user.click(screen.getByRole('option', { name: 'By Language' }));

    expect(
      screen.getByRole('combobox', { name: 'Filter' }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Allow image-based subtitles'),
    ).toBeInTheDocument();
  });

  test('labels the None filter as selecting no subtitles', async () => {
    const { user } = renderEditor({ expanded: true });

    await user.click(
      screen.getByRole('combobox', { name: 'Subtitle Strategy' }),
    );
    await user.click(screen.getByRole('option', { name: 'By Language' }));
    await user.click(screen.getByRole('combobox', { name: 'Filter' }));

    expect(
      screen.getByRole('option', { name: 'None (no subtitles)' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'None (no filter)' }),
    ).toBeNull();
  });

  test('hides the rule controls and locks the fields when read-only', () => {
    renderEditor({ expanded: true, readOnly: true });

    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove rule' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Label' })).toBeDisabled();
  });
});
