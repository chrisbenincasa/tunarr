import type {
  NowPlayingOverlayPayload,
  NowPlayingOverlayWindow,
} from '@/ffmpeg/NowPlayingOverlay.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { isWindows } from '@/util/index.js';
import { FilterOption } from './FilterOption.ts';

export class NowPlayingOverlayFilter extends FilterOption {
  constructor(
    private readonly size: FrameSize,
    private readonly overlay: NowPlayingOverlayPayload,
    private readonly copiedTimestamps = false,
  ) {
    super();
  }

  get filter(): string {
    const filters: string[] = [];

    // Current program overlay (opening + closing windows)
    if (this.overlay.windows.length > 0) {
      filters.push(
        ...this.buildCardFilters(
          this.overlay.title,
          this.overlay.subtitle,
          this.overlay.windows,
        ),
      );
    }

    // Coming up next overlay
    if (this.overlay.nextTitle && this.overlay.comingUpNextWindows.length > 0) {
      const nextSubtitle = this.overlay.nextSubtitle
        ? `${this.overlay.nextTitle} - ${this.overlay.nextSubtitle}`
        : this.overlay.nextTitle;
      filters.push(
        ...this.buildCardFilters(
          'Coming Up Next',
          nextSubtitle,
          this.overlay.comingUpNextWindows,
        ),
      );
    }

    return filters.join(',');
  }

  private buildCardFilters(
    title: string,
    subtitle: string | undefined,
    windows: NowPlayingOverlayWindow[],
  ): string[] {
    const hasSubtitle = !!subtitle;
    const boxWidth = this.size.width;
    const boxHeight = hasSubtitle
      ? Math.max(96, Math.round(this.size.height * 0.12))
      : Math.max(62, Math.round(this.size.height * 0.08));
    const y = this.size.height - boxHeight;
    const titleFontSize = Math.max(24, Math.round(this.size.height / 30));
    const subtitleFontSize = Math.max(18, Math.round(this.size.height / 42));
    const titleY = y + Math.round(boxHeight * (hasSubtitle ? 0.34 : 0.58));
    const subtitleY = y + Math.round(boxHeight * 0.72);
    const textX = 20;
    const fade = this.overlay.fadeDurationSeconds;

    // Each FFmpeg expression has its own registers. With -copyts the first
    // frame can have any PTS; record it once without retiming the video.
    const clock = this.copiedTimestamps ? '(t-ld(0))' : 't';
    const init = this.copiedTimestamps ? 'if(eq(n,0),st(0,t),0);' : '';
    const enable = init + buildEnableExpr(windows, clock);
    const alpha = buildAlphaExpr(windows, fade, clock);
    const escapedEnable = escapeFilterExpression(enable);
    // Run drawtext on the first frame even for a later window, so alpha
    // can initialize its own clock. Its value outside the window is zero.
    const textEnable =
      this.copiedTimestamps && alpha
        ? escapedEnable + '+not(n)'
        : escapedEnable;
    const escapedAlpha = alpha
      ? escapeFilterExpression(init + alpha)
      : undefined;

    const filters: string[] = [];

    // Background box via drawbox (no fade on box, only on text)
    filters.push(
      `drawbox=x=0:y=${y}:w=${boxWidth}:h=${boxHeight}:color=black@0.58:t=fill:enable='${escapedEnable}'`,
    );

    // Title
    filters.push(
      formatDrawText({
        fontFile: this.overlay.fontFile,
        text: title,
        x: textX,
        y: titleY,
        fontSize: titleFontSize,
        enable: textEnable,
        alpha: escapedAlpha,
      }),
    );

    // Subtitle
    if (subtitle) {
      filters.push(
        formatDrawText({
          fontFile: this.overlay.fontFile,
          text: subtitle,
          x: textX,
          y: subtitleY,
          fontSize: subtitleFontSize,
          enable: textEnable,
          alpha: escapedAlpha,
        }),
      );
    }

    return filters;
  }
}

function buildEnableExpr(
  windows: NowPlayingOverlayWindow[],
  clock: string,
): string {
  return windows
    .map((w) =>
      windowExpression(
        clock,
        formatSeconds(w.startSeconds),
        formatSeconds(w.endSeconds),
      ),
    )
    .join('+');
}

function windowExpression(clock: string, start: string, end: string) {
  return `gte(${clock},${start})*lt(${clock},${end})`;
}

function buildAlphaExpr(
  windows: NowPlayingOverlayWindow[],
  fadeDuration: number,
  clock: string,
): string | undefined {
  if (fadeDuration <= 0) {
    return;
  }

  const f = formatSeconds(fadeDuration);
  const parts = windows.map((w) => {
    const s = formatSeconds(w.startSeconds);
    const e = formatSeconds(w.endSeconds);
    return `if(${windowExpression(clock, s, e)},min(1,(${clock}-${s})/${f})*min(1,(${e}-${clock})/${f}),0)`;
  });

  // For multiple windows, sum the parts (only one is active at a time)
  return parts.length === 1 ? parts[0] : parts.join('+');
}

// Both the filtergraph parser and drawtext's option parser consume escapes.
function escapeDrawTextValue(text: string): string {
  return text
    .replaceAll('\\', '\\\\\\\\')
    .replaceAll("'", "\\\\\\'")
    .replaceAll(':', '\\\\:')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll(';', '\\;')
    .replaceAll('#', '\\#')
    .replaceAll(',', '\\,');
}

function escapeDrawTextPath(path: string): string {
  return escapeDrawTextValue(isWindows() ? path.replaceAll('\\', '/') : path);
}

function formatSeconds(seconds: number): string {
  return `${Math.round(seconds * 1000) / 1000}`;
}

function escapeFilterExpression(expr: string): string {
  return expr.replaceAll(',', '\\,');
}

function formatDrawText(args: {
  fontFile?: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  enable: string;
  alpha?: string;
}): string {
  // Convert Windows backslashes to forward slashes before escaping,
  // since FFmpeg expects forward slashes in fontfile paths on all platforms.
  const fontFilePrefix = args.fontFile
    ? `fontfile=${escapeDrawTextPath(args.fontFile)}:`
    : '';

  const alphaSuffix = args.alpha ? `:alpha='${args.alpha}'` : '';

  return `drawtext=${fontFilePrefix}expansion=none:text=${escapeDrawTextValue(args.text)}:x=${args.x}:y=${args.y}:fontsize=${args.fontSize}:fontcolor=white:enable='${args.enable}'${alphaSuffix}`;
}
