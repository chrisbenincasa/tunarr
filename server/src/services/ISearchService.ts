export interface ISearchService {
  start(): Promise<void>;
  restart(): Promise<void>;
  stop(): void;
}
