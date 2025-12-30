import {useQuery, useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import * as puppiesApi from '../services/puppiesApi';
import type {CreatePuppyRequest, PuppyStatus} from '../services/puppiesApi';

// Query keys
export const puppyKeys = {
  all: ['puppies'] as const,
  lists: () => [...puppyKeys.all, 'list'] as const,
  list: (type: 'public' | 'my') => [...puppyKeys.lists(), type] as const,
  details: () => [...puppyKeys.all, 'detail'] as const,
  detail: (id: string) => [...puppyKeys.details(), id] as const,
};

// Query hooks
export function usePuppies(limit = 10) {
  return useInfiniteQuery({
    queryKey: puppyKeys.list('public'),
    queryFn: ({pageParam}) => puppiesApi.fetchPuppies(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
  });
}

export function useMyPuppies(limit = 10) {
  return useInfiniteQuery({
    queryKey: puppyKeys.list('my'),
    queryFn: ({pageParam}) => puppiesApi.fetchMyPuppies(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
  });
}

export function usePuppy(id: string) {
  return useQuery({
    queryKey: puppyKeys.detail(id),
    queryFn: () => puppiesApi.fetchPuppy(id),
    enabled: !!id,
  });
}

// Mutation hooks
export function useCreatePuppy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePuppyRequest) => puppiesApi.createPuppy(data),
    onSuccess: () => {
      // Invalidate my puppies list
      queryClient.invalidateQueries({queryKey: puppyKeys.list('my')});
    },
  });
}

export function useUpdatePuppy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({id, data}: {id: string; data: Partial<CreatePuppyRequest> & {status?: PuppyStatus}}) =>
      puppiesApi.updatePuppy(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific puppy and lists
      queryClient.invalidateQueries({queryKey: puppyKeys.detail(variables.id)});
      queryClient.invalidateQueries({queryKey: puppyKeys.lists()});
    },
  });
}
