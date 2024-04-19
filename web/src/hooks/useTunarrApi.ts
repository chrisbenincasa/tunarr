import { useContext } from 'react';
import { TunarrApiContext } from '../components/TunarrApiContext';

export const useTunarrApi = () => {
  // const { backendUri } = useSettings();
  // const [api, setApi] = useState(createApiClient(backendUri));
  // const queryClient = useQueryClient();

  // useEffect(() => {
  //   setApi(createApiClient(backendUri));
  //   // We have to reset everything when the backend URL changes!
  //   queryClient.resetQueries().catch(console.warn);
  // }, [backendUri, queryClient]);

  // return api;
  return useContext(TunarrApiContext);
};

// export const useWithTunarrApi = () => {
//   const useTunarrApi()
// }
