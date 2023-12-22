import { Program } from 'dizquetv-types';

// A program that may or may not exist in the DB yet
export type EphemeralProgram = Omit<Program, 'id'>;
