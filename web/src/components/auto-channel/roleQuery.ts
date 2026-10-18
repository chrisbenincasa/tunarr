import type { ContentQuery } from '@tunarr/types/api';
import { isEmpty } from 'lodash-es';
import type { GlobalContentContext } from './GlobalContentControls.tsx';

export type YearRange = { start: number; end: number };

export type ShowOption = {
  id: string;
  title: string;
  year: number | null;
};

export type ContentScope = Pick<
  ContentQuery,
  'mediaSourceIds' | 'libraryIds' | 'programTypes'
>;

/**
 * What the user picked for one role. The role's query is derived from this,
 * the preset's default query, and the wizard-wide context.
 */
export type RoleSelection = {
  facetValues?: string[];
  yearRange?: YearRange;
  show?: ShowOption;
  pickerFilter?: string;
  advancedFilter?: string;

  // Present only while the role's "Override" toggle is on.
  override?: ContentScope;
};

export function combineFilters(
  filters: (string | undefined)[],
): string | undefined {
  const parts = filters
    .map((f) => f?.trim())
    .filter((f): f is string => !isEmpty(f));

  if (parts.length === 0) {
    return undefined;
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return parts.map((p) => `(${p})`).join(' AND ');
}

export function buildRoleQuery(
  defaultQuery: ContentQuery,
  selection: RoleSelection | undefined,
  global: GlobalContentContext,
): ContentQuery {
  const scope: ContentScope = selection?.override ?? {
    mediaSourceIds:
      global.mediaSourceId !== undefined
        ? [global.mediaSourceId]
        : defaultQuery.mediaSourceIds,
    libraryIds: !isEmpty(global.libraryIds)
      ? global.libraryIds
      : defaultQuery.libraryIds,
    programTypes: defaultQuery.programTypes,
  };

  const show = selection?.show;

  return {
    ...defaultQuery,
    mediaSourceIds: emptyToUndefined(scope.mediaSourceIds),
    libraryIds: emptyToUndefined(scope.libraryIds),

    // A binge role plays one show's episodes, whatever the scope says.
    programTypes: show
      ? ['episode']
      : emptyToUndefined(scope.programTypes ?? defaultQuery.programTypes),
    groupingId: show?.id ?? defaultQuery.groupingId,
    filterString: combineFilters([
      defaultQuery.filterString,
      selection?.pickerFilter,
      selection?.advancedFilter,
    ]),
  };
}

function emptyToUndefined<T>(arr: T[] | undefined): T[] | undefined {
  return arr && arr.length > 0 ? arr : undefined;
}
