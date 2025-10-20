import { useSlotProgramOptions } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import { SlotProgrammingOptionsContext } from './SlotProgrammingOptionsContext.ts';

type Props = {
  children: React.ReactNode | React.ReactNode[];
};

export const SlotProgrammingOptionsProvider = ({ children }: Props) => {
  const options = useSlotProgramOptions();
  return (
    <SlotProgrammingOptionsContext.Provider value={options.dropdownOpts}>
      {children}
    </SlotProgrammingOptionsContext.Provider>
  );
};
