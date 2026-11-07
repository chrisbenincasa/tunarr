import { renderWithProviders, screen } from '@/test/utils';
import { Grid } from '@mui/material';
import type { SaveableChannel } from '@tunarr/types';
import type { ReactNode } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { describe, expect, test } from 'vitest';
import { minutesToSeconds, secondsToMinutes } from './watermarkTimeLimit.ts';
import { WatermarkTimingFields } from './WatermarkTimingFields.tsx';

type WatermarkValues = Partial<NonNullable<SaveableChannel['watermark']>>;

const Form = ({
  watermark,
  children,
}: {
  watermark: WatermarkValues;
  children: ReactNode;
}) => {
  const methods = useForm<SaveableChannel>({
    defaultValues: { watermark },
  });
  return (
    <FormProvider {...methods}>
      <Grid container>{children}</Grid>
      <StoredDuration />
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
  return renderWithProviders(
    <Form watermark={watermark}>
      <WatermarkTimingFields />
    </Form>,
  );
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

  test('flags a limit that is not a number', async () => {
    const { user } = renderFields({ duration: 0 });

    await user.clear(limitField());
    await user.type(limitField(), 'abc');

    expect(limitField()).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Enter a number of minutes, 0 or more.'),
    ).toBeInTheDocument();
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
    expect(minutesToSeconds('-5')).toBe(0);
    expect(minutesToSeconds('abc')).toBe(0);
  });

  test('round-trips every whole-second value without drifting', () => {
    for (let seconds = 0; seconds <= 7200; seconds++) {
      expect(minutesToSeconds(String(secondsToMinutes(seconds)))).toBe(seconds);
    }
  });
});
