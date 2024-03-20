import { Grid } from '@mui/material';
import { forwardRef } from 'react';
import useStore from '../store';

type TabPanelProps = {
  children?: React.ReactNode;
  index: number;
  value: number;
  ref?: any; // to do
};

const CustomTabPanel = forwardRef((props: TabPanelProps, ref: any) => {
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
});

export default CustomTabPanel;
