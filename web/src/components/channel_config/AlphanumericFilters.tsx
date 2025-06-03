import { Box, Button } from '@mui/material';
import { isEmpty, map } from 'lodash-es';
import type { ForwardedRef } from 'react';
import { forwardRef, useCallback, useState } from 'react';
import { AlphanumericCharCodes } from '../../helpers/constants.ts';

type Props = {
  onAlphaFilterChange: (str: string | null) => void;
};

export const AlphanumericFilters = forwardRef(
  (
    { onAlphaFilterChange }: Props,
    alphaFilterRef: ForwardedRef<HTMLDivElement>,
  ) => {
    const [alphanumericFilter, setAlphanumericFilter] = useState<string | null>(
      null,
    );

    const handleAlphaFilterChange = useCallback(
      (key: string) => {
        if (isEmpty(key.trim())) {
          return;
        }

        const anum = key[0];
        if (!AlphanumericCharCodes.includes(anum.charCodeAt(0))) {
          return;
        }

        setAlphanumericFilter((prev) => (prev === key ? null : key));

        onAlphaFilterChange(key === alphanumericFilter ? null : key);
      },
      [alphanumericFilter, onAlphaFilterChange],
    );

    return (
      <Box
        sx={{
          position: 'fixed',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          right: 0,
          bottom: 'max(10em, env(safe-area-inset-top))',
          width: 35,
          zIndex: 1000,
          fontSize: '85%',
        }}
      >
        <Box sx={{ position: 'sticky' }} ref={alphaFilterRef}>
          {map(AlphanumericCharCodes, (code) => {
            const str = String.fromCharCode(code);
            return (
              <Button
                disableRipple
                sx={{
                  py: 0,
                  px: 1,
                  minWidth: '100%',
                  transition: 'font-size 0.1s',
                  fontSize: alphanumericFilter === str ? '150%' : 'inherit',
                  '&:hover': {
                    transition: 'font-size 0.1s ease-in-out',
                    fontSize: '150%',
                  },
                }}
                key={code}
                onClick={() => handleAlphaFilterChange(str)}
                color={alphanumericFilter === str ? undefined : 'info'}
              >
                {str}
              </Button>
            );
          })}
        </Box>
      </Box>
    );
  },
);
