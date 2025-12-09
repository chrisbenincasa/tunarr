import { createRouter } from '@tanstack/react-router';
import { queryClient } from './queryClient.ts';
import { routeTree } from './routeTree.gen.ts';

// Create a new router instance

export const router = createRouter({
  routeTree,
  context: { queryClient },
});
