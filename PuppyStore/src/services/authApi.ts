import {AuthUser, AuthTokens} from '../types/models/Auth';
import {AuthResponse, LoginRequest, RegisterRequest} from '../types/api/auth';
import {config} from '../config';
import {createApiClient} from './client';

export type {AuthUser, AuthTokens, AuthResponse, LoginRequest, RegisterRequest};

const client = createApiClient(config.api.auth);

export function login(credentials: LoginRequest) {
  return client.post<AuthResponse>('/login', credentials);
}

export function register(data: RegisterRequest) {
  return client.post<AuthResponse>('/register', data);
}

export function refreshTokens(refreshToken: string) {
  return client.post<AuthTokens>('/refresh', {refreshToken});
}

export function getMe(accessToken: string) {
  return client.get<AuthUser>('/me', {accessToken});
}

export function clearPreferences(accessToken: string) {
  return client.delete<{success: boolean}>('/preferences', {accessToken});
}
