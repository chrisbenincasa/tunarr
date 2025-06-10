import type { StrictOmit } from 'ts-essentials';
import type z from 'zod/v4';
import type {
  WorkerRequest,
  WorkerRequestToResponse,
} from '../types/worker_schemas.ts';

export interface IWorkerPool {
  start(): void;
  shutdown(timeout: number): Promise<void>;
  allReady(): Promise<void>;
  queueTask<
    Req extends StrictOmit<WorkerRequest, 'requestId'>,
    Out = z.infer<(typeof WorkerRequestToResponse)[Req['type']]>,
  >(
    request: Req,
    timeout?: number,
  ): Promise<Out>;
}
