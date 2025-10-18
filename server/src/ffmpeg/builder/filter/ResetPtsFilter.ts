import { FilterOption } from './FilterOption.ts';

export class ResetPtsFilter extends FilterOption {
  public filter: string = 'setpts=PTS-STARTPTS';
}
