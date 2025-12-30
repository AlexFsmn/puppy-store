import {AuthUser, AuthTokens} from '../types/models/Auth';
import {AuthResponse, LoginRequest, RegisterRequest} from '../types/api/auth';
import {config} from '../config';
import {createApiClient, type ApiClient} from './client';

export type {AuthUser, AuthTokens, AuthResponse, LoginRequest, RegisterRequest};

let client: ApiClient = createApiClient(config.api.auth);

export function initializeAuthClient(tokenProvider: () => Promise<string | null>) {
  client = createApiClient(config.api.auth, {tokenProvider});
}

export function login(credentials: LoginRequest) {
  return client.post<AuthResponse>('/login', credentials);
}

export function register(data: RegisterRequest) {
  return client.post<AuthResponse>('/register', data);
}

export function refreshTokens(refreshToken: string) {
  return client.post<AuthTokens>('/refresh', {refreshToken});
}

export function getMe() {
  return client.get<AuthUser>('/me');
}

export function clearPreferences() {
  return client.delete<{success: boolean}>('/preferences');
}
