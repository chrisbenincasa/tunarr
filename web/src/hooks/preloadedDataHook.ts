import { useLoaderData } from '@tanstack/react-router';
import { Preloader } from '../types/index.ts';

export function usePreloadedData<U, T extends Preloader<U>>(loader: T) {
  return useLoaderData();
}
