import { evaluate, parse } from '@marcbachmann/cel-js';
import { injectable } from 'inversify';
import { isNativeError } from 'node:util/types';
import { z } from 'zod';
import { BadRequestError } from '../types/errors.ts';
import { Maybe } from '../types/util.ts';
import { InjectLogger } from '../util/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';

export type StreamSelectionCelContext = {
  audio: {
    streams: Array<{
      index: number;
      language: string;
      codec: string;
      channels: number;
      title: string;
      default: boolean;
      selected: boolean;
    }>;
    languages: string[];
  };
  subtitle: {
    streams: Array<{
      index: number;
      language: string;
      codec: string;
      type: string;
      title: string;
      default: boolean;
      forced: boolean;
      sdh: boolean;
    }>;
    languages: string[];
  };
  channel: { name: string; number: number };
  program: { title: string; type: string };
};

@injectable()
export class CelEvaluationService {
  @InjectLogger() declare private readonly logger: Logger;

  evaluate(expression: string, context: StreamSelectionCelContext): boolean {
    try {
      const result = evaluate(expression, context) as unknown;
      return z.boolean().parse(result);
    } catch (err) {
      this.logger.warn(
        { err, expression },
        'CEL expression evaluation failed, treating as false',
      );
      return false;
    }
  }

  validate(expression: string): Maybe<CelEvaluationError> {
    try {
      parse(expression);
      return;
    } catch (err) {
      const errorMessage = isNativeError(err)
        ? err.message
        : JSON.stringify(err);
      return new CelEvaluationError(errorMessage);
    }
  }
}

export class CelEvaluationError extends BadRequestError {
  constructor(...params: ConstructorParameters<ErrorConstructor>) {
    super(...params);
  }
}
