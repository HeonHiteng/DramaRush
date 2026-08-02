import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Content (series/episodes) barely changes during a session and the
      // dataset is tiny — cache generously and avoid refetch storms.
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
