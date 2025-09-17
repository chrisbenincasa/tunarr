interface TabPanelProps<Type = number> {
  children?: React.ReactNode;
  index: Type;
  value: Type;
}

export function TabPanel<Type = number>(props: TabPanelProps<Type>) {
  const { children, value, index, ...other } = props;

  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && children}
    </div>
  );
}
