import { usePreloadedData } from '../../hooks/preloadedDataHook.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';
import { editProgrammingLoader } from './loaders.ts';

export default function ChannelProgrammingPage() {
  const { channel, lineup } = usePreloadedData(editProgrammingLoader);

  setCurrentChannel(channel, lineup.programs);

  return (
    <div>
      Channel {channel.number}, length = {lineup?.programs.length}
    </div>
  );
}
