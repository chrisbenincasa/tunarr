import { SettingsDB } from '@/db/SettingsDB.ts';
import { DB } from '@/db/schema/db.ts';
import { Kysely } from 'kysely';

export type HealthyCheckResult = {
  type: 'healthy';
};

export const HealthyHealthCheckResult: HealthyCheckResult = { type: 'healthy' };

export type NonHealthyCheckResult = {
  type: 'info' | 'warning' | 'error';
  context: string;
};

export type HealthCheckResult = HealthyCheckResult | NonHealthyCheckResult;

export function healthCheckResult(result: HealthCheckResult): typeof result {
  return result;
}

export interface HealthCheck {
  id: string;
  getStatus(): Promise<HealthCheckResult>;
}

export interface HealthCheckConstructable {
  new (db: Kysely<DB>, settings: SettingsDB): HealthCheck;
}
