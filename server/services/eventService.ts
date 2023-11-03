import EventEmitter from 'events';
import createLogger from '../logger.js';
import { FastifyInstance } from 'fastify';
import { Readable } from 'stream';

const logger = createLogger(import.meta);

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

  setup(app: FastifyInstance) {
    app.get('/api/events', (request, response) => {
      logger.info('Open event channel.');
      const outStream = new Readable();
      outStream._read = () => {};

      const listener = (event: string, data: object) => {
        outStream.push(
          `event: ${event}\ndata: ${JSON.stringify(data)}\n retry: 5000\n\n`,
        );
      };

      this.stream.on('push', listener);

      request.socket.on('close', () => {
        logger.info('Remove event channel.');
        this.stream.removeListener('push', listener);
      });

      return response
        .headers({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keey-alive',
        })
        .send(outStream);
    });
  }

  push(event: string, data: Record<string, any>) {
    if (typeof data.message !== 'undefined') {
      logger.info('Push event: ' + data.message);
    }
    this.stream.emit('push', event, data);
  }
}
