export type HealthyCheckResult = {
  type: 'healthy';
  context?: string;
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
