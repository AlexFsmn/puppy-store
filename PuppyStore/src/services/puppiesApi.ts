import {Puppy, MyPuppy} from '../types/models/Puppy';
import {
  CreatePuppyRequest,
  PuppiesResponse,
  MyPuppiesResponse,
} from '../types/api/puppies';
import {PuppyStatus} from '../types/enums';
import {config} from '../config';
import {createApiClient} from './client';

export type {Puppy, MyPuppy, CreatePuppyRequest, PuppiesResponse, MyPuppiesResponse};

const client = createApiClient(config.api.puppies);

export function fetchPuppies(cursor?: string, limit = 10) {
  return client.get<PuppiesResponse>('/puppies', {
    params: {cursor, limit},
  });
}

export function fetchPuppy(id: string) {
  return client.get<Puppy>(`/puppies/${id}`);
}

export function fetchMyPuppies(accessToken: string, cursor?: string, limit = 10) {
  return client.get<MyPuppiesResponse>('/puppies/my', {
    accessToken,
    params: {cursor, limit},
  });
}

export function createPuppy(data: CreatePuppyRequest, accessToken: string) {
  return client.post<Puppy>('/puppies', data, {accessToken});
}

export function updatePuppy(
  id: string,
  data: Partial<CreatePuppyRequest> & {status?: PuppyStatus},
  accessToken: string
) {
  return client.patch<Puppy>(`/puppies/${id}`, data, {accessToken});
}
