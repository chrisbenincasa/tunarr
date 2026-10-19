import {
  HelpMenu,
  type ShellIconButtonVariant,
} from '@/components/ui/patterns/AppShell';
import { useCopyToClipboardSync } from '@/hooks/useCopyToClipboard.ts';
import { useM3ULink } from '@/hooks/useM3ULink.ts';
import { useVersion } from '@/hooks/useVersion.tsx';
import { useXmlTvLink } from '@/hooks/useXmlTvLink.ts';
import { useLingui } from '@lingui/react/macro';

export const HelpMenuContainer = ({
  variant,
}: {
  variant: ShellIconButtonVariant;
}) => {
  const { t } = useLingui();
  const { data: version, isPending, isError } = useVersion();
  const xmlTvUrl = useXmlTvLink();
  const m3uUrl = useM3ULink();
  const copy = useCopyToClipboardSync();

  return (
    <HelpMenu
      variant={variant}
      version={
        isPending
          ? { state: 'loading' }
          : isError
            ? { state: 'error' }
            : {
                state: 'loaded',
                tunarr: version.tunarr,
                ffmpeg: version.ffmpeg,
              }
      }
      onCopyXmlTvUrl={() => copy(xmlTvUrl, t`Copied XMLTV URL to clipboard`)}
      onCopyM3uUrl={() => copy(m3uUrl, t`Copied M3U URL to clipboard`)}
    />
  );
};
