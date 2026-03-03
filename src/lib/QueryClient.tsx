import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Global Error Handling Layer
 * 
 * All API errors (queries and mutations) are caught here and displayed
 * as toast notifications. Individual components can still override with
 * their own onError handlers.
 */
export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error, query) => {
            // Only show toast for queries that have already loaded data once
            // (avoids spamming on initial load failures)
            if (query.state.data !== undefined) {
                toast.error('Data Sync Failed', {
                    description: error.message || 'Failed to refresh data. Using cached version.',
                });
            }
        },
    }),
    mutationCache: new MutationCache({
        onError: (error) => {
            // Mutations always show an error toast unless the component handles it
            toast.error('Operation Failed', {
                description: error.message || 'Something went wrong. Please try again.',
            });
        },
    }),
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes
            retry: 2, // Retry failed queries twice before giving up
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 1, // Retry mutations once for transient errors
        },
    },
});
