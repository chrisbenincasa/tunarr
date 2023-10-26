import EventEmitter from 'events';
import createLogger from '../logger';

const logger = createLogger(module);

export class EventService {
  private stream: EventEmitter;
  private _heartbeat: NodeJS.Timeout;

  constructor() {
    this.stream = new EventEmitter();
    this._heartbeat = setInterval(() => {
      this.push('heartbeat', {});
    }, 5000);
    this.stream.on('close', () => {
      clearInterval(this._heartbeat);
    });
  }

  setup(app) {
    app.get('/api/events', (_request, response) => {
      logger.info('Open event channel.');
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        connection: 'keep-alive',
      });

      const listener = (event: string, data: Record<string, any>) => {
        response.write(
          `event: ${event}\ndata: ${JSON.stringify(data)}\n retry: 5000\n\n`,
        );
      };

      this.stream.on('push', listener);

      response.on('close', () => {
        logger.info('Remove event channel.');
        this.stream.removeListener('push', listener);
      });
    });
  }

  push(event: string, data: Record<string, any>) {
    if (typeof data.message !== 'undefined') {
      logger.info('Push event: ' + data.message);
    }
    this.stream.emit('push', event, data);
  }
}
