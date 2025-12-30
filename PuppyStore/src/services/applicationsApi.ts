import {Application} from '../types/models/Application';
import {ApplicationStatus} from '../types/enums';
import {
  ApplicationsResponse,
  CreateApplicationRequest,
} from '../types/api/applications';
import {config} from '../config';
import {createApiClient, type ApiClient} from './client';

export type {Application, ApplicationsResponse, ApplicationStatus, CreateApplicationRequest};

let client: ApiClient = createApiClient(config.api.puppies);

export function initializeAuthClient(tokenProvider: () => Promise<string | null>) {
  client = createApiClient(config.api.puppies, {tokenProvider});
}

export function submitApplication(data: CreateApplicationRequest) {
  return client.post<Application>('/applications', data);
}

export function fetchMyApplications(cursor?: string, limit = 10) {
  return client.get<ApplicationsResponse>('/applications', {
    params: {cursor, limit},
  });
}

export function fetchReceivedApplications(cursor?: string, limit = 10) {
  return client.get<ApplicationsResponse>('/applications/received', {
    params: {cursor, limit},
  });
}

export function fetchApplication(id: string) {
  return client.get<Application>(`/applications/${id}`);
}

export function updateApplicationStatus(id: string, status: ApplicationStatus) {
  return client.patch<Application>(`/applications/${id}`, {status});
}
