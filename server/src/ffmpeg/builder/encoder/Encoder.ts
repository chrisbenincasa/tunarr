import { PipelineFilterStep } from '../filter/PipelineFilterStep';
import { OutputOption } from '../options/OutputOption';
import { StreamKind } from '../types';

export abstract class Encoder
  extends OutputOption
  implements PipelineFilterStep
{
  name: string;
  kind: StreamKind;
  filter: string;
}
