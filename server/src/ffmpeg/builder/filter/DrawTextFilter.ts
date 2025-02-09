import { FilterOption } from './FilterOption.ts';

interface DrawTextOptions {
  fontfile: string;
  text: string;
  border?: {
    color: string;
    width: number;
  };
  color: string;
  size: string;
  position: {
    x: string;
    y: string;
  };
}

export class DrawTextFilter extends FilterOption {
  constructor(private opts: DrawTextOptions) {
    super();
  }

  get filter() {
    return '';
  }
}
