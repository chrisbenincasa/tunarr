import { QueryClient } from '@tanstack/react-query';
import { Program } from 'dizquetv-types';
import { LoaderFunctionArgs } from 'react-router-dom';

// A program that may or may not exist in the DB yet
export type EphemeralProgram = Omit<Program, 'id'>;

export type Preloader<T> = (
  queryClient: QueryClient,
) => (args: LoaderFunctionArgs) => Promise<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PreloadedData<T extends (...args: any[]) => any> = Awaited<
  ReturnType<ReturnType<T>>
>;
