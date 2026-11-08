import { renderWithProviders, screen } from '@/test/utils';
import { Grid } from '@mui/material';
import type { SaveableChannel } from '@tunarr/types';
import { useState, type ReactNode } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { describe, expect, test, vi } from 'vitest';
import { minutesToSeconds, secondsToMinutes } from './watermarkTimeLimit.ts';
import { WatermarkTimingFields } from './WatermarkTimingFields.tsx';

type WatermarkValues = Partial<NonNullable<SaveableChannel['watermark']>>;

const Form = ({
  watermark,
  onValid,
  children,
}: {
  watermark: WatermarkValues;
  onValid: () => void;
  children: ReactNode;
}) => {
  const methods = useForm<SaveableChannel>({
    mode: 'onChange',
    defaultValues: { watermark },
  });
  const [showFields, setShowFields] = useState(true);
  return (
    <FormProvider {...methods}>
      <Grid container>{showFields && children}</Grid>
      <StoredDuration />
      <button type="button" onClick={methods.handleSubmit(onValid)}>
        Save
      </button>
      <button
        type="button"
        onClick={() => methods.reset({ watermark: { duration: 600 } })}
      >
        Reset to 600
      </button>
      <button type="button" onClick={() => setShowFields(false)}>
        Hide fields
      </button>
    </FormProvider>
  );
};

const StoredDuration = () => {
  const duration = useWatch<SaveableChannel, 'watermark.duration'>({
    name: 'watermark.duration',
  });
  return <output data-testid="stored-duration">{String(duration)}</output>;
};

const storedDuration = () => screen.getByTestId('stored-duration').textContent;
const limitField = () =>
  screen.getByLabelText('Hide Watermark After (minutes)');

function renderFields(watermark: WatermarkValues) {
  const onValid = vi.fn();
  return {
    onValid,
    ...renderWithProviders(
      <Form watermark={watermark} onValid={onValid}>
        <WatermarkTimingFields />
      </Form>,
    ),
  };
}

function precedes(a: HTMLElement, b: HTMLElement) {
  return (
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

describe('WatermarkTimingFields', () => {
  test('puts the time limit in its own group after the fade settings', () => {
    renderFields({ duration: 2700, fadeConfig: [{ periodMins: 5 }] });

    const fadeHeading = screen.getByText('Fade In and Out');
    const fadePeriod = screen.getByLabelText('Fade Period (mins)');
    const limitHeading = screen.getByText('Time Limit');
    const limit = limitField();

    expect(precedes(fadeHeading, fadePeriod)).toBe(true);
    expect(precedes(fadePeriod, limitHeading)).toBe(true);
    expect(precedes(limitHeading, limit)).toBe(true);
    expect(limit).toHaveValue('45');
  });

  test('says the time limit overrides the fade settings', () => {
    renderFields({ duration: 0 });

    expect(
      screen.getByText(/overrides the fade settings above/),
    ).toBeInTheDocument();
  });

  test('shows the leading edge option only when a fade period is set', () => {
    renderFields({ fadeConfig: [{ periodMins: 5 }] });
    expect(
      screen.getByLabelText('Display Watermark on Leading Edge'),
    ).toBeInTheDocument();
  });

  test('hides the leading edge option with no fade period', () => {
    renderFields({});
    expect(
      screen.queryByLabelText('Display Watermark on Leading Edge'),
    ).not.toBeInTheDocument();
  });

  test('stores the limit in seconds when minutes are typed', async () => {
    const { user } = renderFields({ duration: 0 });

    await user.clear(limitField());
    await user.type(limitField(), '1.5');

    expect(limitField()).toHaveValue('1.5');
    expect(storedDuration()).toBe('90');
  });

  test('lets the limit field be cleared to mean no limit', async () => {
    const { user } = renderFields({ duration: 600 });

    await user.clear(limitField());

    expect(limitField()).toHaveValue('');
    expect(storedDuration()).toBe('0');
  });

  test('keeps the typed text when it rounds to whole seconds', async () => {
    const { user } = renderFields({ duration: 0 });

    await user.clear(limitField());
    await user.type(limitField(), '1.01');

    expect(limitField()).toHaveValue('1.01');
    expect(storedDuration()).toBe('61');
  });

  test('renders a stored limit that is not a whole number of seconds', () => {
    renderFields({ duration: 90.5 });

    expect(limitField()).toHaveValue('1.51');
    expect(storedDuration()).toBe('90.5');
  });

  test('re-seeds the field when the form is reset', async () => {
    const { user } = renderFields({ duration: 2700 });

    await user.clear(limitField());
    await user.type(limitField(), '3');
    await user.click(screen.getByRole('button', { name: 'Reset to 600' }));

    expect(limitField()).toHaveValue('10');
  });

  test('flags a limit that is not a number and blocks saving', async () => {
    const { user, onValid } = renderFields({ duration: 2700 });

    await user.clear(limitField());
    await user.type(limitField(), '45m');

    expect(limitField()).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Enter a number of minutes, 0 or more.'),
    ).toBeInTheDocument();
    expect(storedDuration()).not.toBe('0');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onValid).not.toHaveBeenCalled();
  });

  test('clears the error once the limit is a number again', async () => {
    const { user, onValid } = renderFields({
      duration: 0,
      fadeConfig: [{ periodMins: 0 }],
    });

    await user.clear(limitField());
    await user.type(limitField(), 'abc');
    await user.clear(limitField());
    await user.type(limitField(), '30');

    expect(limitField()).toHaveAttribute('aria-invalid', 'false');
    expect(storedDuration()).toBe('1800');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onValid).toHaveBeenCalledOnce();
  });

  test('saves the last valid limit when the field is hidden with bad text', async () => {
    const { user, onValid } = renderFields({ duration: 2700 });

    await user.clear(limitField());
    await user.type(limitField(), '30x');
    expect(limitField()).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: 'Hide fields' }));
    expect(storedDuration()).toBe('1800');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onValid).toHaveBeenCalledOnce();
  });
});

describe('limit unit conversion', () => {
  test('shows seconds as minutes', () => {
    expect(secondsToMinutes(2700)).toBe(45);
    expect(secondsToMinutes(90)).toBe(1.5);
    expect(secondsToMinutes(0)).toBe(0);
  });

  test('turns typed minutes into whole seconds', () => {
    expect(minutesToSeconds('45')).toBe(2700);
    expect(minutesToSeconds('1.01')).toBe(61);
    expect(minutesToSeconds('')).toBe(0);
    expect(minutesToSeconds('0')).toBe(0);
  });

  test('rejects text that is not a number of 0 or more', () => {
    expect(minutesToSeconds('-5')).toBeNaN();
    expect(minutesToSeconds('abc')).toBeNaN();
    expect(minutesToSeconds('45m')).toBeNaN();
  });

  test('round-trips every whole-second value without drifting', () => {
    for (let seconds = 0; seconds <= 7200; seconds++) {
      expect(minutesToSeconds(String(secondsToMinutes(seconds)))).toBe(seconds);
    }
  });
});
