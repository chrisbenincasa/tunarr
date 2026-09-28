import { getApiStreamSelectionProfilesOptions } from '@/generated/@tanstack/react-query.gen';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RouterLink } from '../base/RouterLink.tsx';

// Select can't hold null, so "no assignment" is represented by this value.
const Unassigned = '__unassigned__';

type Props = {
  value: string | null;
  onChange: (profileId: string | null) => void;
  // Describes what happens when no profile is assigned, e.g. "Use channel
  // profile". Defaults to naming the default profile.
  unassignedLabel?: string;
  helperText?: ReactNode;
};

/**
 * Picks the stream selection profile assigned to a channel, filler list, or
 * custom show. `null` means "not assigned": the next level of the resolution
 * chain decides.
 */
export const StreamSelectionProfileSelect = ({
  value,
  onChange,
  unassignedLabel,
  helperText,
}: Props) => {
  const { data: profiles = [] } = useQuery(
    getApiStreamSelectionProfilesOptions(),
  );
  const defaultProfile = profiles.find((p) => p.isDefault);
  const selected = profiles.find((p) => p.uuid === value);

  return (
    <FormControl margin="normal" fullWidth>
      <InputLabel id="stream-selection-profile-label">
        <Trans>Stream Selection Profile</Trans>
      </InputLabel>
      <Select
        labelId="stream-selection-profile-label"
        label={t`Stream Selection Profile`}
        value={value ?? Unassigned}
        onChange={(e) =>
          onChange(e.target.value === Unassigned ? null : e.target.value)
        }
      >
        <MenuItem value={Unassigned}>
          <em>
            {unassignedLabel ??
              t`Default (${defaultProfile?.name ?? t`Tunarr Default`})`}
          </em>
        </MenuItem>
        {profiles.map((profile) => (
          <MenuItem key={profile.uuid} value={profile.uuid}>
            {profile.name}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText component="div">
        <Stack spacing={0.5}>
          {helperText && <span>{helperText}</span>}
          <span>
            {selected && (
              <>
                <RouterLink
                  to="/profiles/stream-selection/$profileId"
                  params={{ profileId: selected.uuid }}
                >
                  {selected.locked ? (
                    <Trans>View profile</Trans>
                  ) : (
                    <Trans>Edit profile</Trans>
                  )}
                </RouterLink>
                {' · '}
              </>
            )}
            <RouterLink to="/profiles/stream-selection/new">
              <Trans>Create a new profile</Trans>
            </RouterLink>
            {' · '}
            <RouterLink to="/profiles/stream-selection">
              <Trans>Manage profiles</Trans>
            </RouterLink>
          </span>
        </Stack>
      </FormHelperText>
    </FormControl>
  );
};
