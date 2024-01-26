import { useEffect, useState } from 'react';
import useDebouncedState from './useDebouncedState.ts';

// useful for forms that take numeric input, but don't want
// to manage the wonky state of validity / what value to show in the
// text input field, etc.
export const useNumberString = (
  initialState: number,
  isFloat: boolean = false,
) => {
  const [num, setNum] = useState(initialState);
  const [str, debouncedStr, setStr] = useDebouncedState(
    initialState.toString(),
  );
  const [valid, setValid] = useState(true);

  useEffect(() => {
    const parsed = isFloat ? parseFloat(debouncedStr) : parseInt(debouncedStr);
    setValid(!isNaN(parsed));
    if (!isNaN(parsed)) {
      setNum(parsed);
    }
  }, [debouncedStr, isFloat]);

  return {
    numValue: num,
    strValue: str,
    isValid: valid,
    setValue: setStr,
  };
};
