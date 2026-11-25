// The store has to load before its action modules, which import it back
// through a cycle, the way the app's entry point loads it.
import useStore from '../../store/index.ts';
import { renderWithProviders, screen } from '@/test/utils';
import type { Channel } from '@tunarr/types';
import { describe, expect, test, vi } from 'vitest';
import { RebuildEachCycleField } from './RebuildEachCycleField.tsx';

function editChannel(onDemand: boolean) {
  const channel: Channel = {
    disableFillerOverlay: false,
    duration: 0,
    groupTitle: '',
    guideMinimumDuration: 30000,
    icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
    id: 'ch-1',
    name: 'Channel 1',
    number: 1,
    offline: { mode: 'pic' },
    startTime: 0,
    stealth: false,
    onDemand: { enabled: onDemand },
    programCount: 0,
    streamMode: 'hls',
    transcodeConfigId: '11111111-1111-4111-8111-111111111111',
    subtitlesEnabled: false,
    useEtvNext: false,
    streamSelectionProfileId: null,
  };
  useStore.setState((state) => {
    state.channelEditor.currentEntity = channel;
  });
}

describe('RebuildEachCycleField', () => {
  test('a regular channel can turn the option off', async () => {
    editChannel(false);
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <RebuildEachCycleField value onChange={onChange} />,
    );

    const toggle = screen.getByLabelText('Rebuild each cycle');
    expect(toggle).toBeChecked();
    expect(toggle).toBeEnabled();

    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('an on-demand channel shows the option off and locked', () => {
    editChannel(true);
    renderWithProviders(<RebuildEachCycleField value onChange={vi.fn()} />);

    const toggle = screen.getByLabelText('Rebuild each cycle');
    expect(toggle).not.toBeChecked();
    expect(toggle).toBeDisabled();
    expect(
      screen.getByText(/On-demand channels replay their saved lineup/),
    ).toBeInTheDocument();
  });
});
