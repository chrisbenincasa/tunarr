import { MeilisearchService } from '@/services/MeilisearchService.js';
import { inject, injectable } from 'inversify';
import {
  HealthCheck,
  HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck.ts';

@injectable()
export class SearchHealthCheck implements HealthCheck {
  readonly id = 'SearchServer';

  constructor(
    @inject(MeilisearchService) private searchService: MeilisearchService,
  ) {}

  getStatus(): Promise<HealthCheckResult> {
    switch (this.searchService.getHealthStatus()) {
      case 'starting':
        return Promise.resolve(
          healthCheckResult({
            type: 'info',
            context: 'Search server is starting up.',
          }),
        );
      case 'healthy':
        return Promise.resolve(HealthyHealthCheckResult);
      case 'degraded':
        return Promise.resolve(
          healthCheckResult({
            type: 'warning',
            context:
              'Search server failed a health check and a restart was attempted. Search may be temporarily unavailable.',
          }),
        );
      case 'error':
        return Promise.resolve(
          healthCheckResult({
            type: 'error',
            context:
              'Search server is not responding and could not be restarted. Search functionality is unavailable. Check server logs.',
          }),
        );
    }
  }
}
