import path from 'node:path';
import { globalOptions } from '../globals.ts';

export function getDatabasePath(dbPath: string) {
  return path.join(globalOptions().databaseDirectory, dbPath);
}
