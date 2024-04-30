import { FilterOption } from './FilterOption.ts';

export class StaticFilter extends FilterOption {
  public filter: string = 'geq=random(1)*255:128:128';
}
