import { Trans, useLingui } from '@lingui/react/macro';
import {
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Switch,
} from '@mui/material';
import useStore from '../../store/index.ts';

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
};

export function RebuildEachCycleField({ value, onChange }: Props) {
  const { t } = useLingui();
  const onDemand = useStore(
    (s) => s.channelEditor.currentEntity?.onDemand.enabled ?? false,
  );

  return (
    <FormGroup>
      <FormControlLabel
        control={
          <Switch
            checked={value && !onDemand}
            disabled={onDemand}
            onChange={(_, checked) => onChange(checked)}
          />
        }
        label={t`Rebuild each cycle`}
      />
      <FormHelperText>
        {onDemand ? (
          <Trans>
            On-demand channels replay their saved lineup, so they can't rebuild.
          </Trans>
        ) : (
          <Trans>
            Builds new programming before the current programming runs out.
            Shuffled slots get a new order each cycle, and ordered shows
            continue where they left off. Days to Precalculate only sets the
            preview length.
          </Trans>
        )}
      </FormHelperText>
    </FormGroup>
  );
}
