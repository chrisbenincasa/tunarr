import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../../generated/sdk.gen.ts';

const mocks = vi.hoisted(() => ({
  facets: vi.fn(),
}));

vi.mock('../../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  postApiProgramsFacetsByFacetName: mocks.facets,
}));

const { renderWithProviders, screen } = await import('../../../test/utils.tsx');
const { FacetPicker } = await import('./FacetPicker.tsx');

const facetFields = ['genre', 'studio'];

describe('FacetPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.facets.mockResolvedValue({ data: { facetValues: { HBO: 3 } } });
  });

  // An imported template sets the field through props, so the picker must
  // show it rather than fall back to the first field.
  test('shows the field passed in props', async () => {
    renderWithProviders(
      <FacetPicker
        facetFields={facetFields}
        label="Networks"
        field="studio"
        value={['HBO']}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Studio' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Genre' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await waitFor(() =>
      expect(mocks.facets).toHaveBeenCalledWith(
        expect.objectContaining({ path: { facetName: 'studio.name' } }),
      ),
    );
  });

  test('falls back to the first field when the prop is not offered', () => {
    renderWithProviders(
      <FacetPicker
        facetFields={facetFields}
        label="Networks"
        field="actor"
        value={[]}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Genre' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('reports the active field with picked values', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <FacetPicker
        facetFields={facetFields}
        label="Networks"
        field="studio"
        value={[]}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByLabelText('Networks'), 'HBO{Enter}');

    expect(onChange).toHaveBeenLastCalledWith(
      ['HBO'],
      expect.stringContaining('HBO'),
      'studio',
    );
  });

  test('reports a field switch and clears the values', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <FacetPicker
        facetFields={facetFields}
        label="Networks"
        field="studio"
        value={['HBO']}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Genre' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith([], '', 'genre');
  });
});
