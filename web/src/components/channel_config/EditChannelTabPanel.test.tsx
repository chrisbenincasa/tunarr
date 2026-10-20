import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, test, vi } from 'vitest';
import {
  EditChannelTabPanel,
  type EditChannelTabs,
} from './EditChannelTabPanel';

const onMount = vi.fn<(label: string) => void>();
const onRender = vi.fn<(label: string) => void>();

function Probe({ label }: { label: string }) {
  onRender(label);
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
    onMount.mockClear();
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
});
