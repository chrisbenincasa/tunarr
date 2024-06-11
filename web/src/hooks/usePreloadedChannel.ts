import { useChannelEditor } from '../store/selectors.ts';

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
