import { useLoaderData } from 'react-router-dom';
import { PreloadedData, Preloader } from '../types/index.ts';

export function usePreloadedData<U, T extends Preloader<U>>(loader: T) {
  return useLoaderData() as PreloadedData<typeof loader>;
}
