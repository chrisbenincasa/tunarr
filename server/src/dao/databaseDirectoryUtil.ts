import { globalOptions } from '@/globals';
import path from 'node:path';

export function getDatabasePath(dbPath: string) {
  return path.join(globalOptions().databaseDirectory, dbPath);
}
