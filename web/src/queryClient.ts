import { QueryCache } from '@tanstack/react-query';

// Shared query cache so non-hook / in-component usages share the same
// underlying cache
export const queryCache = new QueryCache();
