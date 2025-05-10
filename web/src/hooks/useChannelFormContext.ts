import type { SaveableChannel } from '@tunarr/types';
import { useFormContext } from 'react-hook-form';

export const useChannelFormContext = () => useFormContext<SaveableChannel>();
