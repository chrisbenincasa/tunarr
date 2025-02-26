import { TypedEventEmitter } from '@/types/eventEmitter.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { TunarrEvent } from '@tunarr/types';
import { FastifyInstance } from 'fastify';
import { injectable } from 'inversify';
import { isString } from 'lodash-es';
import EventEmitter from 'node:events';
import { Readable } from 'node:stream';
import { setInterval } from 'node:timers';
import { v4 } from 'uuid';

type Events = {
  close: () => void;
  push: (event: TunarrEvent) => void;
};

@injectable()
export class EventService {
  private static stream: TypedEventEmitter<Events> =
    new EventEmitter() as TypedEventEmitter<Events>;
  // Everything we need to close if the underlying EventService
  // closes.
  private static rawConnections: Record<string, NodeJS.WritableStream> = {};

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
      Object.values(EventService.rawConnections).forEach((conn) => conn.end());
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
        const id = v4();

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
          delete EventService.rawConnections[id];
        });

        EventService.rawConnections[id] = response.raw;

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
