import { FrameSize } from '@/ffmpeg/builder/types.js';
import { isWindows } from '@/util/index.js';
import { NowPlayingOverlayFilter } from './NowPlayingOverlayFilter.ts';

describe('NowPlayingOverlayFilter', () => {
  test('renders a full-width lower-third with title and subtitle', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Song Title',
      subtitle: 'Artist - Album',
      windows: [{ startSeconds: 0, endSeconds: 8 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).toContain(
      "drawbox=x=0:y=624:w=1280:h=96:color=black@0.58:t=fill:enable='between(t\\,0\\,8)'",
    );
    expect(filter.filter).toContain('expansion=none:text=Song Title');
    expect(filter.filter).toContain('text=Artist - Album');
  });

  test('escapes colons and brackets in text values', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Title: Part [2]',
      windows: [{ startSeconds: 0, endSeconds: 8 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).toContain('text=Title\\\\: Part \\[2\\]');
  });

  test('escapes apostrophes in text', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: "Don't Stop Me Now",
      windows: [{ startSeconds: 0, endSeconds: 8 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).toContain("text=Don\\\\\\'t Stop Me Now");
  });

  test('escapes semicolons and hashes in text', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Track #1; Remix',
      windows: [{ startSeconds: 0, endSeconds: 8 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).toContain('text=Track \\#1\\; Remix');
  });

  test('preserves percent signs in text when expansion is disabled', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: '100% Pure',
      windows: [{ startSeconds: 0, endSeconds: 8 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).toContain('expansion=none:text=100% Pure');
  });

  test('escapes colon in Windows font path', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Song Title',
      windows: [{ startSeconds: 0, endSeconds: 5.5 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
      fontFile: 'C:\\Windows\\Fonts\\arial.ttf',
    });

    if (isWindows()) {
      expect(filter.filter).toContain('fontfile=C\\\\:/Windows/Fonts/arial.ttf');
    } else {
      expect(filter.filter).toContain('fontfile=C:/Windows/Fonts/arial.ttf');
    }
  });

  test('generates fade alpha expression when fadeDurationSeconds > 0', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Song Title',
      windows: [{ startSeconds: 2, endSeconds: 10 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0.5,
    });

    expect(filter.filter).toContain(
      "alpha='if(between(t\\,2\\,10)\\,min(1\\,(t-2)/0.5)*min(1\\,(10-t)/0.5)\\,0)'",
    );
  });

  test('omits alpha when fadeDurationSeconds is 0', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Song Title',
      windows: [{ startSeconds: 0, endSeconds: 8 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).not.toContain('alpha=');
  });

  test('renders coming-up-next card with its own enable window', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Current Song',
      subtitle: 'Current Artist',
      nextTitle: 'Next Song',
      nextSubtitle: 'Next Artist',
      windows: [{ startSeconds: 0, endSeconds: 8 }],
      comingUpNextWindows: [{ startSeconds: 150, endSeconds: 156 }],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).toContain('text=Current Song');
    expect(filter.filter).toContain(
      'text=Coming Up Next',
    );
    expect(filter.filter).toContain('text=Next Song - Next Artist');
    expect(filter.filter).toContain("enable='between(t\\,150\\,156)'");
  });

  test('escapes commas in text values', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Artist, Live',
      windows: [{ startSeconds: 0, endSeconds: 8 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).toContain('text=Artist\\, Live');
  });

  test('does not render coming-up-next when comingUpNextWindows is empty', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Song Title',
      nextTitle: 'Next Song',
      windows: [{ startSeconds: 0, endSeconds: 8 }],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).not.toContain('Coming up');
  });

  test('renders multiple enable windows for opening + closing', () => {
    const filter = new NowPlayingOverlayFilter(FrameSize.SevenTwenty, {
      title: 'Song Title',
      windows: [
        { startSeconds: 0, endSeconds: 6 },
        { startSeconds: 172, endSeconds: 180 },
      ],
      comingUpNextWindows: [],
      fadeDurationSeconds: 0,
    });

    expect(filter.filter).toContain(
      "enable='between(t\\,0\\,6)+between(t\\,172\\,180)'",
    );
  });
});
