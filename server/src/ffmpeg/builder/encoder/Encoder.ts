import { PipelineFilterStep } from '../filter/PipelineFilterStep';
import { OutputOption } from '../options/OutputOption';
import { StreamKind } from '../types';

export interface Encoder extends OutputOption, PipelineFilterStep {
  name: string;
  kind: StreamKind;
}
