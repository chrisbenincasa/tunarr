import { useChannelEditor } from '../store/selectors.ts';
import { useParams } from '@tanstack/react-router';
import { useChannel } from './useChannels.ts';

// export const usePreloadedChannel = () => {
//   const channel = usePreloadedData(channelLoader);
//   // Channel loader should've already set the state.
//   return useChannelWithInitialData(channel.id, channel);
// };

export const usePreloadedChannelEdit = () => {
  // const { channel: preloadChannel, programming: preloadLineup } =
  // usePreloadedData(editProgrammingLoader);
  // const { channelId } = Route.useParams();

  // const {
  //   data: { channel, lineup },
  // } = useChannelAndProgramming(channelId);

  const channelEditor = useChannelEditor();

  // useEffect(() => {
  //   if (
  //     isUndefined(channelEditor.originalEntity) ||
  //     channel.id !== channelEditor.originalEntity.id
  //   ) {
  //     setCurrentChannel(channel, lineup);
  //   }
  // }, [channelEditor, channel, lineup]);

  return channelEditor;
};

export const usePreloadedChannel = (isNew: boolean) => {
  const { originalEntity } = useChannelEditor();
  const { channelId } = useParams({ strict: false });
  const { data } = useChannel(channelId ?? '', !isNew);
  // TODO: Unclear whether we can universally make this assumption
  // let's follow up here to see if there is a better way to handle
  // this. Perhaps separating out the entrypoints for new / update channels
  // and having them feed the selected channel into a subcomponent
  if (isNew) {
    return originalEntity!;
  } else {
    return data!;
  }
};

// export const useResetCurrentLineup = () => {
//   const { id } = useParams();
//   const { data: lineup } = useChannelProgramming(id!);
//   const [isReset, setIsReset] = useState(false);

//   const queryClient = useQueryClient();

//   useEffect(() => {
//     if (lineup && isReset) {
//       resetCurrentLineup(lineup.lineup, lineup.programs);
//       setIsReset(false);
//     }
//   }, [lineup, isReset, setIsReset]);

//   return useCallback(() => {
//     if (!isReset) {
//       setIsReset(true);
//       queryClient
//         .invalidateQueries({
//           exact: false,
//           queryKey: ['channels', id!, 'programming'],
//         })
//         .catch(console.error);
//     }
//   }, [isReset, queryClient, id]);
// };
