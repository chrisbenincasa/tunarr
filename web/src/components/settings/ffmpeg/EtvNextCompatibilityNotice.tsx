import {
  getApiEtvTranscodeConfigsByIdCompatibilityOptions,
  getApiSystemFeatureFlagsOptions,
  getChannelsOptions,
} from '@/generated/@tanstack/react-query.gen';
import { Trans } from '@lingui/react/macro';
import { Alert, AlertTitle, Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

type Props = {
  configId: string;

  /** Set by a channel form whose unsaved opt-in box is ticked. */
  channelOptedIn?: boolean;
};

/**
 * Warns that a saved transcode config will not survive the ErsatzTV next
 * backend intact.
 *
 * Without this the first sign of an unsupported codec is a channel that fails
 * to start, because the backend is only handed the config at spawn time.
 * Shown when the global flag is on or when a channel on this config opted in
 * by itself. Otherwise nothing reads the config differently.
 */
export const EtvNextCompatibilityNotice = ({
  configId,
  channelOptedIn = false,
}: Props) => {
  const { data: flags } = useQuery(getApiSystemFeatureFlagsOptions());
  const { data: channels } = useQuery(getChannelsOptions());
  const enabled =
    channelOptedIn ||
    flags?.flags.ersatzTvNextEnabled === true ||
    (channels ?? []).some(
      (channel) => channel.useEtvNext && channel.transcodeConfigId === configId,
    );

  const { data } = useQuery({
    ...getApiEtvTranscodeConfigsByIdCompatibilityOptions({
      path: { id: configId },
    }),
    enabled,
  });

  if (!enabled || data === undefined) {
    return null;
  }

  const { unsupported, ignored } = data;
  if (unsupported.length === 0 && ignored.length === 0) {
    return null;
  }

  return (
    <Box>
      {unsupported.length > 0 && (
        <Alert severity="error" sx={{ mb: ignored.length > 0 ? 2 : 0 }}>
          <AlertTitle>
            <Trans>
              Channels using this config cannot stream on the ErsatzTV next
              backend
            </Trans>
          </AlertTitle>
          <ul>
            {unsupported.map(({ field, value, reason }) => (
              <li key={field}>
                <strong>{field}</strong> ({value}) {reason}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {ignored.length > 0 && (
        <Alert severity="warning">
          <AlertTitle>
            <Trans>
              The ErsatzTV next backend ignores some of these settings
            </Trans>
          </AlertTitle>
          <ul>
            {ignored.map(({ field, reason }) => (
              <li key={field}>
                <strong>{field}</strong> &mdash; {reason}
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </Box>
  );
};
