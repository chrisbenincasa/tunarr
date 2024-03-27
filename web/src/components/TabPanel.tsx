import { Unstable_Grid2 as Grid } from '@mui/material';
import { ForwardedRef, forwardRef } from 'react';
import useStore from '../store';

type TabPanelProps = {
  children?: React.ReactNode;
  index: number;
  value: number;
  ref?: React.RefObject<HTMLDivElement>;
};

const CustomTabPanel = forwardRef(
  (props: TabPanelProps, ref: ForwardedRef<HTMLDivElement>) => {
    const { children, value, index, ...other } = props;

    const viewType = useStore((state) => state.theme.programmingSelectorView);

    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        key={value}
        {...other}
      >
        {value === index && children && (
          <Grid
            container
            component={'div'}
            spacing={2}
            sx={{
              display: viewType === 'grid' ? 'grid' : 'flex',
              gridTemplateColumns:
                viewType === 'grid'
                  ? 'repeat(auto-fill, minmax(160px, 1fr))'
                  : 'none',
              justifyContent: viewType === 'grid' ? 'space-around' : 'normal',
              mt: 2,
            }}
            ref={ref}
          >
            {children}
          </Grid>
        )}
      </div>
    );
  },
);

export default CustomTabPanel;
