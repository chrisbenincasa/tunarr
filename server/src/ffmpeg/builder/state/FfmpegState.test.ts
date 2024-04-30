import { FfmpegState } from './FfmpegState';

describe('FfmpegState', () => {
  test('partial construction', () => {
    const defaultState = FfmpegState.create();
    const state = FfmpegState.create({ start: '123' });

    expect(state).toEqual({
      ...defaultState,
      start: '123',
    });
  });
});
