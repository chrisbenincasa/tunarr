import { PipelineFilterStep } from '../filter/PipelineFilterStep';
import { StreamKind } from '../types';

export interface Encoder extends PipelineFilterStep {
  name: string;
  kind: StreamKind;
}
