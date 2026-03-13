export interface Command<Request, Result = void> {
  run(request: Request): Promise<Result>;
}
