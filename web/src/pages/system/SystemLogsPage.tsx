import { isString } from 'lodash-es';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SystemLogsView } from '../../components/system/system-logs/SystemLogsView.tsx';
import {
  type LogLine,
  parseLogLine,
} from '../../components/system/system-logs/logLine.ts';
import { useSettings } from '../../store/settings/selectors.ts';

const MaxLines = 1000;

export function SystemLogsPage() {
  const { backendUri } = useSettings();
  const [lines, setLines] = useState<LogLine[]>([]);

  // The lines on screen while paused. The stream keeps filling `lines`.
  const [snapshot, setSnapshot] = useState<LogLine[] | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const source = new EventSource(`${backendUri}/api/system/debug/logs`);
    source.addEventListener('message', ({ data }: MessageEvent) => {
      if (!isString(data)) {
        return;
      }
      const line = parseLogLine(data, nextId.current);
      if (!line) {
        return;
      }
      nextId.current += 1;
      setLines((prev) => [line, ...prev].slice(0, MaxLines));
    });
    return () => source.close();
  }, [backendUri]);

  const togglePause = useCallback(
    () => setSnapshot((current) => (current ? null : lines)),
    [lines],
  );

  const downloadUrl = useCallback(
    (lineLimit?: number) =>
      `${backendUri}/api/system/debug/logs?download=true&pretty=true${
        lineLimit ? `&lineLimit=${lineLimit}` : ''
      }`,
    [backendUri],
  );

  const newestId = (buffer: LogLine[]) => buffer[0]?.id ?? -1;

  return (
    <SystemLogsView
      lines={snapshot ?? lines}
      paused={snapshot !== null}
      newWhilePaused={snapshot ? newestId(lines) - newestId(snapshot) : 0}
      onTogglePause={togglePause}
      downloadUrl={downloadUrl}
    />
  );
}
