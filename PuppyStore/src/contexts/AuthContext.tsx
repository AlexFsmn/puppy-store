import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import * as Keychain from 'react-native-keychain';
import {jwtDecode} from 'jwt-decode';
import {AuthUser, LoginRequest, RegisterRequest} from '../types';
import * as authApi from '../services/authApi';

interface JwtPayload {
  exp: number;
  sub: string;
}

// Refresh token 1 minute before it expires
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
  clearPreferences: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_SERVICE = 'puppy-store-access';
const REFRESH_TOKEN_SERVICE = 'puppy-store-refresh';

async function storeTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await Keychain.setGenericPassword('token', accessToken, {
    service: ACCESS_TOKEN_SERVICE,
  });
  await Keychain.setGenericPassword('token', refreshToken, {
    service: REFRESH_TOKEN_SERVICE,
  });
}

async function getStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const accessResult = await Keychain.getGenericPassword({
    service: ACCESS_TOKEN_SERVICE,
  });
  const refreshResult = await Keychain.getGenericPassword({
    service: REFRESH_TOKEN_SERVICE,
  });

  return {
    accessToken: accessResult ? accessResult.password : null,
    refreshToken: refreshResult ? refreshResult.password : null,
  };
}

async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({service: ACCESS_TOKEN_SERVICE});
  await Keychain.resetGenericPassword({service: REFRESH_TOKEN_SERVICE});
}

function getTokenExpirationMs(token: string): number | null {
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    return decoded.exp * 1000; // Convert to milliseconds
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string): boolean {
  const expirationMs = getTokenExpirationMs(token);
  if (!expirationMs) return true;
  return Date.now() >= expirationMs - TOKEN_REFRESH_BUFFER_MS;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({children}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokens, setTokens] = useState<{
    accessToken: string | null;
    refreshToken: string | null;
  }>({accessToken: null, refreshToken: null});
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);

  // Helper to refresh tokens
  const performTokenRefresh = useCallback(async (): Promise<string | null> => {
    if (isRefreshingRef.current) {
      return null;
    }

    const stored = await getStoredTokens();
    if (!stored.refreshToken) {
      return null;
    }

    isRefreshingRef.current = true;
    try {
      const newTokens = await authApi.refreshTokens(stored.refreshToken);
      await storeTokens(newTokens.accessToken, newTokens.refreshToken);
      setTokens({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      });
      return newTokens.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Refresh failed, log out user
      await clearTokens();
      setTokens({accessToken: null, refreshToken: null});
      setUser(null);
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  // Schedule next token refresh based on expiration
  const scheduleTokenRefresh = useCallback(
    (accessToken: string) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      const expirationMs = getTokenExpirationMs(accessToken);
      if (!expirationMs) return;

      // Refresh 1 minute before expiration
      const refreshTime = expirationMs - Date.now() - TOKEN_REFRESH_BUFFER_MS;

      if (refreshTime <= 0) {
        // Token is already expired or expiring soon, refresh now
        performTokenRefresh();
      } else {
        refreshTimerRef.current = setTimeout(() => {
          performTokenRefresh();
        }, refreshTime);
      }
    },
    [performTokenRefresh],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Schedule refresh when tokens change
  useEffect(() => {
    if (tokens.accessToken) {
      scheduleTokenRefresh(tokens.accessToken);
    }
  }, [tokens.accessToken, scheduleTokenRefresh]);

  // Load stored tokens and user on mount
  useEffect(() => {
    async function loadAuth() {
      try {
        const storedTokens = await getStoredTokens();
        if (storedTokens.accessToken) {
          setTokens(storedTokens);
          // Try to get user info
          try {
            const userData = await authApi.getMe(storedTokens.accessToken);
            setUser(userData);
          } catch {
            // Access token might be expired, try refresh
            if (storedTokens.refreshToken) {
              try {
                const newTokens = await authApi.refreshTokens(
                  storedTokens.refreshToken,
                );
                await storeTokens(newTokens.accessToken, newTokens.refreshToken);
                setTokens({
                  accessToken: newTokens.accessToken,
                  refreshToken: newTokens.refreshToken,
                });
                const userData = await authApi.getMe(newTokens.accessToken);
                setUser(userData);
              } catch {
                // Refresh failed, clear everything
                await clearTokens();
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading auth:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAuth();
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await authApi.login(credentials);
    await storeTokens(response.accessToken, response.refreshToken);
    setTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    setUser(response.user);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    await storeTokens(response.accessToken, response.refreshToken);
    setTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setTokens({accessToken: null, refreshToken: null});
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // Check in-memory token first
    let currentToken = tokens.accessToken;

    // Fall back to Keychain if in-memory state is empty
    if (!currentToken) {
      const stored = await getStoredTokens();
      if (stored.accessToken) {
        setTokens(stored);
        currentToken = stored.accessToken;
      }
    }

    if (!currentToken) {
      return null;
    }

    // If token is expiring soon, try to refresh it
    if (isTokenExpiringSoon(currentToken)) {
      const newToken = await performTokenRefresh();
      return newToken || currentToken; // Fall back to current if refresh fails
    }

    return currentToken;
  }, [tokens.accessToken, performTokenRefresh]);

  const refreshUser = useCallback(async () => {
    if (!tokens.accessToken) {
      return;
    }

    try {
      const userData = await authApi.getMe(tokens.accessToken);
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [tokens.accessToken]);

  const clearPreferences = useCallback(async () => {
    if (!tokens.accessToken) {
      return;
    }

    try {
      await authApi.clearPreferences(tokens.accessToken);
      // Refresh user to get updated state (null preferences)
      const userData = await authApi.getMe(tokens.accessToken);
      setUser(userData);
    } catch (error) {
      console.error('Failed to clear preferences:', error);
      throw error;
    }
  }, [tokens.accessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        getAccessToken,
        refreshUser,
        clearPreferences,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
