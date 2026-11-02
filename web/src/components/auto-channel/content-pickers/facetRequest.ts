import type { PostApiProgramsFacetsByFacetNameData } from '../../../generated/types.gen.ts';

type FacetRequest = Omit<PostApiProgramsFacetsByFacetNameData, 'url'>;

// The route declares a JSON body, so Fastify rejects a POST without one.
export function facetRequest(
  facetName: string,
  facetQuery: string,
  mediaSourceId?: string,
  libraryId?: string,
): FacetRequest {
  return {
    path: { facetName },
    query: {
      facetQuery: facetQuery || undefined,
      mediaSourceId,
      libraryId,
    },
    body: {},
  };
}
