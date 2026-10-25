import type { RolePreview } from '@/hooks/useAutoChannel.ts';
import { describe, expect, test } from 'vitest';
import { rolePreviewStatus } from './rolePreviewStatus.ts';

function preview(overrides: Partial<RolePreview>): RolePreview {
  return {
    data: undefined,
    isLoading: false,
    error: null,
    awaitingInput: false,
    ...overrides,
  };
}

function withTotal(totalPrograms: number): RolePreview {
  return preview({
    data: {
      totalPrograms,
      byType: {
        episode: 0,
        movie: 0,
        music_video: 0,
        other_video: 0,
        track: 0,
      },
      topShows: [],
      totalDurationMs: 0,
      sampleIds: [],
    },
  });
}

describe('rolePreviewStatus', () => {
  test('asks for a selection when the role has no preview yet', () => {
    expect(rolePreviewStatus(undefined, 1)).toEqual({
      status: 'idle',
      label: 'Needs a selection',
    });
    expect(rolePreviewStatus(preview({ awaitingInput: true }), 1).label).toBe(
      'Needs a selection',
    );
  });

  test('reports a failed preview as an error', () => {
    expect(rolePreviewStatus(preview({ error: new Error('boom') }), 1)).toEqual(
      { status: 'error', label: 'Preview failed' },
    );
  });

  test('shows a counting state while the preview loads', () => {
    expect(rolePreviewStatus(preview({ isLoading: true }), 1)).toEqual({
      status: 'idle',
      label: 'Counting',
    });
  });

  test('reports zero matches as an error', () => {
    expect(rolePreviewStatus(withTotal(0), 1)).toEqual({
      status: 'error',
      label: 'No matches',
    });
  });

  test('warns when fewer programs match than the role wants', () => {
    expect(rolePreviewStatus(withTotal(3), 10)).toEqual({
      status: 'warning',
      label: '3 programs',
    });
  });

  test('marks enough matches as live and uses the singular for one', () => {
    expect(rolePreviewStatus(withTotal(12), 10)).toEqual({
      status: 'live',
      label: '12 programs',
    });
    expect(rolePreviewStatus(withTotal(1), 0)).toEqual({
      status: 'live',
      label: '1 program',
    });
  });
});
