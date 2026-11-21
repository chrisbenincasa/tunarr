import {
  getApiEtvTranscodeConfigsByIdCompatibilityQueryKey,
  getApiEtvTranscodeConfigsByIdHardwareQueryKey,
  getApiSystemFeatureFlagsQueryKey,
  getChannelsQueryKey,
} from '@/generated/@tanstack/react-query.gen.ts';
import type {
  GetApiEtvTranscodeConfigsByIdCompatibilityResponse,
  GetApiEtvTranscodeConfigsByIdHardwareResponse,
} from '@/generated/types.gen.ts';
import { renderWithProviders, screen, seededQueryClient } from '@/test/utils';
import { describe, expect, test } from 'vitest';
import { EtvNextCompatibilityNotice } from './EtvNextCompatibilityNotice.tsx';

const configId = 'c0ffee00-0000-4000-8000-000000000000';
const path = { path: { id: configId } };

const compatible: GetApiEtvTranscodeConfigsByIdCompatibilityResponse = {
  supported: true,
  unsupported: [],
  ignored: [],
};

const renderNotice = (
  compatibility: GetApiEtvTranscodeConfigsByIdCompatibilityResponse,
  hardware: GetApiEtvTranscodeConfigsByIdHardwareResponse,
) =>
  renderWithProviders(
    <EtvNextCompatibilityNotice configId={configId} channelOptedIn />,
    {
      queryClient: seededQueryClient([
        [getApiSystemFeatureFlagsQueryKey(), { flags: {} }],
        [getChannelsQueryKey(), []],
        [
          getApiEtvTranscodeConfigsByIdCompatibilityQueryKey(path),
          compatibility,
        ],
        [getApiEtvTranscodeConfigsByIdHardwareQueryKey(path), hardware],
      ]),
    },
  );

describe('EtvNextCompatibilityNotice', () => {
  test('lists what the hardware probe found', async () => {
    renderNotice(compatible, {
      warnings: [
        {
          field: 'videoBitDepth',
          reason:
            'vaapi cannot encode 10-bit h264 on this machine, so it encodes in software',
        },
      ],
    });

    expect(
      await screen.findByText(/cannot encode this config in hardware/),
    ).toBeInTheDocument();
    expect(screen.getByText('videoBitDepth')).toBeInTheDocument();
    expect(
      screen.getByText(/vaapi cannot encode 10-bit h264/),
    ).toBeInTheDocument();
  });

  test('renders nothing when the config and hardware are both fine', () => {
    const { container } = renderNotice(compatible, { warnings: [] });

    expect(container).toBeEmptyDOMElement();
  });
});
