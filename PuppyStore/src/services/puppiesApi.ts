import {Puppy, MyPuppy} from '../types/models/Puppy';
import {
  CreatePuppyRequest,
  PuppiesResponse,
  MyPuppiesResponse,
} from '../types/api/puppies';
import {PuppyStatus} from '../types/enums';
import {config} from '../config';
import {createApiClient, type ApiClient} from './client';

export type {Puppy, MyPuppy, CreatePuppyRequest, PuppiesResponse, MyPuppiesResponse, PuppyStatus};

let client: ApiClient = createApiClient(config.api.puppies);

export function initializeAuthClient(tokenProvider: () => Promise<string | null>) {
  client = createApiClient(config.api.puppies, {tokenProvider});
}

export function fetchPuppies(cursor?: string, limit = 10) {
  return client.get<PuppiesResponse>('/puppies', {
    params: {cursor, limit},
  });
}

export function fetchPuppy(id: string) {
  return client.get<Puppy>(`/puppies/${id}`);
}

export function fetchMyPuppies(cursor?: string, limit = 10) {
  return client.get<MyPuppiesResponse>('/puppies/my', {
    params: {cursor, limit},
  });
}

export function createPuppy(data: CreatePuppyRequest) {
  return client.post<Puppy>('/puppies', data);
}

export function updatePuppy(
  id: string,
  data: Partial<CreatePuppyRequest> & {status?: PuppyStatus}
) {
  return client.patch<Puppy>(`/puppies/${id}`, data);
}
