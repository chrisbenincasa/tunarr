import { Type, ValidationError } from '@mikro-orm/core';
import { isString, isUndefined } from 'lodash-es';

export type Resolution = {
  widthPx: number;
  heightPx: number;
};

export class ResolutionType extends Type<Resolution, string> {
  convertToDatabaseValue(value: string | Resolution): string {
    if (!isString(value)) {
      return `${value.widthPx}x${value.heightPx}`;
    }

    if (!value || value.match(/\d+x\d+/g)) {
      return value;
    }

    throw ValidationError.invalidType(ResolutionType, value, 'JS');
  }

  convertToJSValue(value: string | Resolution): Resolution {
    if (!value || !isString(value)) {
      return value as Resolution;
    }

    const resolution = tryParseResolution(value);

    if (isUndefined(resolution)) {
      throw ValidationError.invalidType(ResolutionType, value, 'database');
    }

    return resolution;
  }
}

function tryParseResolution(s: string | undefined): Resolution | undefined {
  if (isUndefined(s)) {
    return undefined;
  }

  const parts = s.split('x', 2);
  if (parts.length < 2) {
    return undefined;
  }

  const x = parseInt(parts[0]);
  const y = parseInt(parts[1]);

  if (isNaN(x) || isNaN(y)) {
    return undefined;
  }

  return {
    widthPx: x,
    heightPx: y,
  };
}
