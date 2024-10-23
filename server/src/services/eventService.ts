import { TunarrEvent } from '@tunarr/types';
import EventEmitter from 'events';
import { FastifyInstance } from 'fastify';
import { isString } from 'lodash-es';
import { Readable } from 'stream';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

type Events = {
  close: () => void;
  push: (event: TunarrEvent) => void;
};

export class EventService {
  private static stream: TypedEventEmitter<Events> =
    new EventEmitter() as TypedEventEmitter<Events>;

  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });
  private _heartbeat: NodeJS.Timeout;

  constructor() {
    this._heartbeat = setInterval(() => {
      this.push({ type: 'heartbeat', level: 'info' });
    }, 5000).unref();

    EventService.stream.on('close', () => {
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
        this.logger.debug({ ip: request.ip }, 'Open event channel');
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

        EventService.stream.on('push', listener);

        request.socket.on('close', () => {
          this.logger.debug({ ip: request.ip }, 'Remove event channel.');
          EventService.stream.removeListener('push', listener);
        });

        EventService.stream.on('close', () => {
          response.raw.end();
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
      this.logger.debug('Push event: ' + data['message']); // Why?
    }
    EventService.stream.emit('push', { ...data });
  }

  close() {
    EventService.stream.emit('close');
  }
}
