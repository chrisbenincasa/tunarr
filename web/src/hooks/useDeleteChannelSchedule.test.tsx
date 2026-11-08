// The store has to load before its action modules, which import it back
// through a cycle, the way the app's entry point loads it.
import useStore from '../store/index.ts';
import type * as Gen from '@/generated/@tanstack/react-query.gen.ts';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import type { TimeSlotSchedule } from '@tunarr/types/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useDeleteChannelSchedule } from './useDeleteChannelSchedule.ts';

const mocks = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock('@/generated/@tanstack/react-query.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Gen>()),
  deleteChannelScheduleMutation: () => ({
    mutationFn: (vars: unknown) =>
      Promise.resolve().then(() => mocks.remove(vars)),
  }),
}));

const schedule: TimeSlotSchedule = {
  type: 'time',
  flexPreference: 'distribute',
  latenessMs: 0,
  maxDays: 7,
  overflow: { type: 'duration', maxMs: 0 },
  padMs: 0,
  period: 'day',
  slots: [],
  timeZoneOffset: 0,
};

function Probe() {
  const deleteSchedule = useDeleteChannelSchedule();
  return (
    <button onClick={() => deleteSchedule.mutate({ path: { id: 'ch-1' } })}>
      remove
    </button>
  );
}

describe('useDeleteChannelSchedule', () => {
  beforeEach(() => {
    mocks.remove.mockReset();
    useStore.setState((state) => {
      state.channelEditor.schedule = schedule;
    });
  });

  test('clears the editor schedule after the server removes it', async () => {
    const { user } = renderWithProviders(<Probe />);

    await user.click(screen.getByRole('button', { name: 'remove' }));

    await waitFor(() =>
      expect(useStore.getState().channelEditor.schedule).toBeUndefined(),
    );
    expect(mocks.remove).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'ch-1' } }),
    );
  });

  test('keeps the editor schedule when the request fails', async () => {
    mocks.remove.mockImplementation(() => {
      throw new Error('boom');
    });
    const { user } = renderWithProviders(<Probe />);

    await user.click(screen.getByRole('button', { name: 'remove' }));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalled());
    expect(useStore.getState().channelEditor.schedule).toEqual(schedule);
  });
});
