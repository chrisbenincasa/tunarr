import { useChannelsAndSessions } from '@/hooks/useChannelSessions.ts';
import {
  Box,
  LinearProgress,
  Table,
  TableBody,
  Typography,
} from '@mui/material';
import { compact, isEmpty } from 'lodash-es';
import { P, match } from 'ts-pattern';
import { map } from 'zod';

export const ActiveSessionsTable = () => {
  const [channelsQuery, channelSessions] = useChannelsAndSessions();

  const renderActiveSessions = () => {
    const contents = match([channelsQuery, channelSessions] as const)
      .with([P._, { isLoading: true }], () => <LinearProgress />)
      // .with([P._, { data: P.when(isEmpty) }], () => (
      //   <Typography sx={{ textAlign: 'center' }}>
      //     There are no active sessions.
      //   </Typography>
      // ))
      .with(
        [
          P.select('channels', { data: P.nonNullable }),
          P.select('sessions', { data: P.nonNullable }),
        ],
        ({ channels, sessions }) => {
          if (isEmpty(sessions.data)) {
            return (
              <Typography sx={{ textAlign: 'center' }}>
                There are no active sessions.
              </Typography>
            );
          } else {
            return compact(
              map(channels.data, (channel) => {
                if (!sessions.data?.[channel.id]) {
                  return;
                }

                return <span key={channel.id}>{channel.name}</span>;
              }),
            );
          }
        },
      )
      .otherwise(() => null);

    return (
      <Table>
        <TableBody>{contents}</TableBody>
      </Table>
    );
  };

  return (
    <Box>
      {channelSessions.isLoading && <LinearProgress />}
      {channelSessions.data && isEmpty(channelSessions.data) && (
        <Typography sx={{ textAlign: 'center' }}>
          There are no active sessions.
        </Typography>
      )}
      {renderActiveSessions()}
    </Box>
  );
};
