import {useQuery, useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import * as applicationsApi from '../services/applicationsApi';
import type {CreateApplicationRequest, ApplicationStatus} from '../services/applicationsApi';

// Query keys
export const applicationKeys = {
  all: ['applications'] as const,
  lists: () => [...applicationKeys.all, 'list'] as const,
  list: (type: 'my' | 'received') => [...applicationKeys.lists(), type] as const,
  details: () => [...applicationKeys.all, 'detail'] as const,
  detail: (id: string) => [...applicationKeys.details(), id] as const,
};

// Query hooks
export function useMyApplications(limit = 10) {
  return useInfiniteQuery({
    queryKey: applicationKeys.list('my'),
    queryFn: ({pageParam}) => applicationsApi.fetchMyApplications(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
  });
}

export function useReceivedApplications(limit = 10) {
  return useInfiniteQuery({
    queryKey: applicationKeys.list('received'),
    queryFn: ({pageParam}) => applicationsApi.fetchReceivedApplications(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
  });
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: applicationKeys.detail(id),
    queryFn: () => applicationsApi.fetchApplication(id),
    enabled: !!id,
  });
}

// Mutation hooks
export function useSubmitApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApplicationRequest) => applicationsApi.submitApplication(data),
    onSuccess: () => {
      // Invalidate my applications list
      queryClient.invalidateQueries({queryKey: applicationKeys.list('my')});
    },
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({id, status}: {id: string; status: ApplicationStatus}) =>
      applicationsApi.updateApplicationStatus(id, status),
    onSuccess: (_, variables) => {
      // Invalidate specific application and lists
      queryClient.invalidateQueries({queryKey: applicationKeys.detail(variables.id)});
      queryClient.invalidateQueries({queryKey: applicationKeys.lists()});
    },
  });
}
