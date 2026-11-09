import { useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import type { ProgramOrFolder, TerminalProgram } from '@tunarr/types';
import { isTerminalItemType } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/schemas';
import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { getApiProgramsByIdOptions } from '../../generated/@tanstack/react-query.gen.ts';
import {
  formatTerminalProgramTitle,
  videoTypeFilter,
} from '../../helpers/programSearch.ts';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useChannelFormContext } from '../../hooks/useChannelFormContext.ts';
import { ProgramSearchAutocomplete } from '../ProgramSearchAutocomplete.tsx';

function isVideoProgram(item: ProgramOrFolder): item is TerminalProgram {
  return isTerminalItemType(item) && item.type !== 'track';
}

export function ChannelFallbackClipInput() {
  const { t } = useLingui();
  const { control } = useChannelFormContext();
  const fallbackProgramId = useWatch({ control, name: 'fallbackProgramId' });
  const [selected, setSelected] = useState<TerminalProgram | null>(null);
  const [searchQuery, setSearchQuery] = useState<SearchRequest>({
    query: '',
    filter: videoTypeFilter,
    restrictSearchTo: ['title'],
  });

  // A clip picked in this session is already in hand. A saved clip is
  // looked up by ID so the input can show its title.
  const needsLookup =
    isNonEmptyString(fallbackProgramId) && selected?.uuid !== fallbackProgramId;
  const { data: savedProgram } = useQuery({
    ...getApiProgramsByIdOptions({ path: { id: fallbackProgramId ?? '' } }),
    enabled: needsLookup,
  });

  let value: TerminalProgram | null = null;
  if (needsLookup) {
    value = savedProgram ?? null;
  } else if (isNonEmptyString(fallbackProgramId)) {
    value = selected;
  }

  return (
    <Controller
      name="fallbackProgramId"
      control={control}
      rules={{
        validate: (id, form) =>
          form.offline.mode !== 'clip' ||
          isNonEmptyString(id) ||
          t`Choose a clip to play during flex time.`,
      }}
      render={({ field, fieldState }) => (
        <ProgramSearchAutocomplete<TerminalProgram>
          searchQuery={searchQuery}
          enabled={isNonEmptyString(searchQuery.query)}
          value={value}
          includeItem={isVideoProgram}
          onChange={(program) => {
            setSelected(program);
            field.onChange(program.uuid);
          }}
          onQueryChange={(query) => setSearchQuery({ ...searchQuery, query })}
          label={t`Fallback Clip`}
          renderOptionTitle={formatTerminalProgramTitle}
          error={!!fieldState.error}
          helperText={fieldState.error?.message}
        />
      )}
    />
  );
}
