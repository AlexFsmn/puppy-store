import {Application} from '../types/models/Application';
import {ApplicationStatus} from '../types/enums';
import {
  ApplicationsResponse,
  CreateApplicationRequest,
} from '../types/api/applications';
import {config} from '../config';
import {createApiClient} from './client';

export type {Application, ApplicationsResponse, ApplicationStatus, CreateApplicationRequest};

const client = createApiClient(config.api.puppies);

export function submitApplication(data: CreateApplicationRequest, accessToken: string) {
  return client.post<Application>('/applications', data, {accessToken});
}

export function fetchMyApplications(accessToken: string, cursor?: string, limit = 10) {
  return client.get<ApplicationsResponse>('/applications', {
    accessToken,
    params: {cursor, limit},
  });
}

export function fetchReceivedApplications(accessToken: string, cursor?: string, limit = 10) {
  return client.get<ApplicationsResponse>('/applications/received', {
    accessToken,
    params: {cursor, limit},
  });
}

export function fetchApplication(id: string, accessToken: string) {
  return client.get<Application>(`/applications/${id}`, {accessToken});
}

export function updateApplicationStatus(id: string, status: ApplicationStatus, accessToken: string) {
  return client.patch<Application>(`/applications/${id}`, {status}, {accessToken});
}
