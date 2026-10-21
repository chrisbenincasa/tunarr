import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  EditChannelTabPanel,
  type EditChannelTabProps,
  type EditChannelTabs,
} from './EditChannelTabPanel';
import { firstTabWithError, tabId } from './editChannelTabs.ts';

const onMount = vi.fn<(label: string) => void>();
const onRender = vi.fn<(label: string) => void>();

beforeEach(() => {
  onMount.mockClear();
  onRender.mockClear();
});

// An effect with no deps runs once per committed render.
function Probe({ label }: { label: string }) {
  useEffect(() => onRender(label));
  useEffect(() => onMount(label), [label]);
  return <span>{label}</span>;
}

function Panels({ current }: { current: EditChannelTabs }) {
  return (
    <>
      <EditChannelTabPanel value="properties" currentValue={current}>
        <Probe label="properties" />
      </EditChannelTabPanel>
      <EditChannelTabPanel value="flex" currentValue={current}>
        <Probe label="flex" />
      </EditChannelTabPanel>
    </>
  );
}

function calls(fn: typeof onMount, label: string) {
  return fn.mock.calls.filter(([l]) => l === label).length;
}

describe('EditChannelTabPanel', () => {
  test('does not mount a panel before its first visit', () => {
    render(<Panels current="properties" />);

    expect(screen.getByText('properties')).toBeVisible();
    expect(screen.queryByText('flex')).not.toBeInTheDocument();
  });

  test('keeps a visited panel mounted and hidden after switching away', () => {
    const { rerender } = render(<Panels current="properties" />);

    rerender(<Panels current="flex" />);
    rerender(<Panels current="properties" />);
    rerender(<Panels current="flex" />);

    expect(calls(onMount, 'properties')).toBe(1);
    expect(calls(onMount, 'flex')).toBe(1);
    expect(screen.getByText('properties')).not.toBeVisible();
    expect(screen.getByText('flex')).toBeVisible();
  });

  test('skips renders while hidden and re-renders when shown again', () => {
    const { rerender } = render(<Panels current="properties" />);
    rerender(<Panels current="flex" />);

    onRender.mockClear();
    rerender(<Panels current="flex" />);
    rerender(<Panels current="flex" />);

    expect(calls(onRender, 'properties')).toBe(0);
    expect(calls(onRender, 'flex')).toBe(2);

    rerender(<Panels current="properties" />);
    expect(calls(onRender, 'properties')).toBe(1);
  });

  test('each panel is labelled by its own tab', () => {
    render(<Panels current="properties" />);

    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    expect(panels.map((p) => p.getAttribute('aria-labelledby'))).toEqual([
      tabId('properties'),
      tabId('flex'),
    ]);
  });

  test('passes extra props through to the panel element', () => {
    render(
      <EditChannelTabPanel
        value="epg"
        currentValue="epg"
        {...{ 'data-testid': 'epg-panel' }}
      />,
    );

    expect(screen.getByTestId('epg-panel')).toHaveAttribute('role', 'tabpanel');
  });
});

describe('firstTabWithError', () => {
  const tabs: EditChannelTabProps[] = [
    { value: 'properties', description: '', fields: ['number', 'name'] },
    {
      value: 'flex',
      description: '',
      fields: ['offline', 'fillerCollections'],
    },
    { value: 'ffmpeg', description: '', fields: ['watermark'] },
  ];

  test('picks the first tab in display order, not error order', () => {
    expect(firstTabWithError(tabs, ['watermark', 'fillerCollections'])).toBe(
      'flex',
    );
  });

  test('returns undefined when no tab owns an errored field', () => {
    expect(firstTabWithError(tabs, ['stealth'])).toBeUndefined();
    expect(firstTabWithError(tabs, [])).toBeUndefined();
  });
});
