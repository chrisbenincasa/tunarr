import { FrameStateUpdater, PipelineStep } from '../types';

export interface Option<Requirements extends unknown[] = []>
  extends PipelineStep<Requirements>,
    FrameStateUpdater {}
