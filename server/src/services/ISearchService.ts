export type SearchHealthStatus = 'starting' | 'healthy' | 'degraded' | 'error';

export interface ISearchService {
  start(): Promise<void>;
  restart(): Promise<void>;
  stop(): void;
  getHealthStatus(): SearchHealthStatus;
}
