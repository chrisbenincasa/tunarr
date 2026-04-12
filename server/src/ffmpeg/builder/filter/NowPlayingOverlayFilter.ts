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
    if (
      this.overlay.nextTitle &&
      this.overlay.comingUpNextWindows.length > 0
    ) {
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

    const enable = buildEnableExpr(windows);
    const alpha = buildAlphaExpr(windows, fade);
    const escapedEnable = escapeFilterExpression(enable);
    const escapedAlpha = alpha ? escapeFilterExpression(alpha) : undefined;

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
        enable: escapedEnable,
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
          enable: escapedEnable,
          alpha: escapedAlpha,
        }),
      );
    }

    return filters;
  }
}

function buildEnableExpr(windows: NowPlayingOverlayWindow[]): string {
  return windows
    .map(
      (w) =>
        `between(t,${formatSeconds(w.startSeconds)},${formatSeconds(w.endSeconds)})`,
    )
    .join('+');
}

function buildAlphaExpr(
  windows: NowPlayingOverlayWindow[],
  fadeDuration: number,
): string | undefined {
  if (fadeDuration <= 0) {
    return;
  }

  const f = formatSeconds(fadeDuration);
  const parts = windows.map((w) => {
    const s = formatSeconds(w.startSeconds);
    const e = formatSeconds(w.endSeconds);
    return `if(between(t,${s},${e}),min(1,(t-${s})/${f})*min(1,(${e}-t)/${f}),0)`;
  });

  // For multiple windows, sum the parts (only one is active at a time)
  return parts.length === 1 ? parts[0] : parts.join('+');
}

// drawtext text=... has different parsing rules than fontfile=... and than the
// filter expressions used by enable=/alpha=. Keeping them separate is the only
// reliable way to preserve text like "Don't Speak" across platforms.
//
// FFmpeg filtergraphs require a second escaping layer for text values. In
// practice that means text=... needs filtergraph-safe escapes such as \\'
// for apostrophes and \\: for colons, while expressions and paths follow
// different rules.
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

// FFmpeg accepts forward slashes on all platforms. On Windows, drive-letter
// paths need the colon escaped as C\\:/... inside filter graphs; macOS/Linux
// paths do not have that prefix and should otherwise pass through untouched.
function escapeDrawTextPath(path: string): string {
  let escaped = path.replaceAll('\\', '/');

  if (isWindows()) {
    escaped = escaped.replaceAll(':/', '\\\\:/');
  }

  return escaped
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll(';', '\\;')
    .replaceAll('#', '\\#')
    .replaceAll(',', '\\,');
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
