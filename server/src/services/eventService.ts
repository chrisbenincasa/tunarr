import { TunarrEvent } from '@tunarr/types';
import EventEmitter from 'events';
import { FastifyInstance } from 'fastify';
import { isString } from 'lodash-es';
import { Readable } from 'stream';
import createLogger from '../logger.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';

const logger = createLogger(import.meta);

type Events = {
  close: () => void;
  push: (event: TunarrEvent) => void;
};

export class EventService {
  private stream: TypedEventEmitter<Events>;
  private _heartbeat: NodeJS.Timeout;

  constructor() {
    this.stream = new EventEmitter() as TypedEventEmitter<Events>;
    this._heartbeat = setInterval(() => {
      this.push({ type: 'heartbeat', level: 'info' });
    }, 5000);
    this.stream.on('close', () => {
      clearInterval(this._heartbeat);
    });
  }

  setup(app: FastifyInstance) {
    app.get(
      '/api/events',
      {
        schema: {
          hide: true,
        },
      },
      (request, response) => {
        logger.info('Open event channel.');
        const outStream = new Readable();
        outStream._read = () => {};

        const listener = (data: TunarrEvent) => {
          const parts = [
            `event: message`,
            `data: ${JSON.stringify(data)}`,
            'retry: 5000',
          ].join('\n');
          outStream.push(parts + '\n\n');
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
            Connection: 'keep-alive',
          })
          .send(outStream);
      },
    );
  }

  push(data: TunarrEvent) {
    if (isString(data['message'])) {
      logger.debug('Push event: ' + data['message']); // Why?
    }
    this.stream.emit('push', { ...data });
  }
}
