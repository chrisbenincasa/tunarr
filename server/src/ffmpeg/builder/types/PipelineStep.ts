import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Dictionary } from 'ts-essentials';

export type PipelineStepType =
  | 'global'
  | 'filter'
  | 'output'
  | 'input'
  | 'environment';

export interface IPipelineStep<
  Requirements extends unknown[] = [],
  OutType = string[],
> {
  type: PipelineStepType;
  options(...reqs: Requirements): OutType;
}

export interface OptionPipelineStep<Requirements extends unknown[] = []>
  extends IPipelineStep<Requirements>,
    FrameStateUpdater {}

export interface GlobalOptionPipelineStep extends OptionPipelineStep {
  readonly type: 'global';
}

export interface OutputOptionPipelineStep extends OptionPipelineStep {
  readonly type: 'output';
}

export interface InputOptionPipelineStep
  extends OptionPipelineStep<[InputSource]> {
  readonly type: 'input';
}

export interface FilterOptionPipelineStep extends OptionPipelineStep {
  readonly type: 'filter';
}

export interface HasFilterOption {
  filter: string;
}

export interface EnvironmentVariablePipelineStep
  extends IPipelineStep<[], Dictionary<string, string>> {
  readonly type: 'environment';
}

export interface FrameStateUpdater {
  affectsFrameState: boolean;
  nextState(currentState: FrameState): FrameState;
}

export type PipelineStep =
  | GlobalOptionPipelineStep
  | InputOptionPipelineStep
  | OutputOptionPipelineStep
  | FilterOptionPipelineStep
  | EnvironmentVariablePipelineStep;

export function isGlobalOption(
  step: PipelineStep,
): step is GlobalOptionPipelineStep {
  return step.type === 'global';
}

export function isInputOption(
  step: PipelineStep,
): step is InputOptionPipelineStep {
  return step.type === 'input';
}

export function isOutputOption(
  step: PipelineStep,
): step is OutputOptionPipelineStep {
  return step.type === 'output';
}

export function isEnvironmentVariableOption(
  step: PipelineStep,
): step is EnvironmentVariablePipelineStep {
  return step.type === 'environment';
}

export function isFilterOption(
  step: PipelineStep,
): step is FilterOptionPipelineStep {
  return step.type === 'filter';
}
