import bcrypt from 'bcrypt';
import {
  prisma,
  z,
  ServiceError,
  CommonErrors,
  CommonErrorCode,
  ErrorCode,
  ErrorMessage,
  defineErrors,
  createErrorHandler,
} from '@puppy-store/shared';
import {TokenPayload} from '../types';
import {generateAccessToken, generateRefreshToken, verifyToken} from '../tokens';

const SALT_ROUNDS = 12;

// Zod schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').transform((s) => s.trim()),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const validateSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type RegisterData = z.infer<typeof registerSchema>;
export type LoginData = z.infer<typeof loginSchema>;

// Domain-specific error codes
const AuthErrorCode = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  INVALID_TOKEN: 'INVALID_TOKEN',
} as const;

const DomainErrors = defineErrors({
  [AuthErrorCode.INVALID_CREDENTIALS]: 401,
  [AuthErrorCode.EMAIL_EXISTS]: 409,
  [AuthErrorCode.INVALID_TOKEN]: 401,
} as const);

const AuthErrorMessage = {
  [AuthErrorCode.INVALID_CREDENTIALS]: 'Invalid credentials',
  [AuthErrorCode.EMAIL_EXISTS]: 'Email already registered',
  [AuthErrorCode.INVALID_TOKEN]: 'Invalid token',
};

export const AuthErrors = {...CommonErrors, ...DomainErrors};
export type AuthErrorCodeType = CommonErrorCode | keyof typeof DomainErrors;

export class AuthError extends ServiceError<AuthErrorCodeType> {
  constructor(code: AuthErrorCodeType, message: string) {
    super(code, message, AuthErrors[code]);
    this.name = 'AuthError';
  }
}

export const handleAuthError = createErrorHandler(AuthErrors, 'Auth');

export async function registerUser(data: RegisterData) {
  const existing = await prisma.user.findUnique({
    where: {email: data.email.toLowerCase()},
  });

  if (existing) {
    throw new AuthError(AuthErrorCode.EMAIL_EXISTS, AuthErrorMessage.EMAIL_EXISTS);
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      name: data.name.trim(),
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  const payload: TokenPayload = {userId: user.id, email: user.email};
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {user, accessToken, refreshToken};
}

export async function loginUser(data: LoginData) {
  const user = await prisma.user.findUnique({
    where: {email: data.email.toLowerCase()},
  });

  if (!user) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, AuthErrorMessage.INVALID_CREDENTIALS);
  }

  const validPassword = await bcrypt.compare(data.password, user.passwordHash);

  if (!validPassword) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, AuthErrorMessage.INVALID_CREDENTIALS);
  }

  const payload: TokenPayload = {userId: user.id, email: user.email};
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    user: {id: user.id, email: user.email, name: user.name},
    accessToken,
    refreshToken,
  };
}

export async function refreshTokens(refreshToken: string) {
  const payload = verifyToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: {id: payload.userId},
    select: {id: true, email: true},
  });

  if (!user) {
    throw new AuthError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('User'));
  }

  const newPayload: TokenPayload = {userId: user.id, email: user.email};
  const accessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  return {accessToken, refreshToken: newRefreshToken};
}

export async function getCurrentUser(token: string) {
  const payload = verifyToken(token);

  const user = await prisma.user.findUnique({
    where: {id: payload.userId},
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      location: true,
      savedPreferences: true,
      preferencesUpdatedAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AuthError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('User'));
  }

  return user;
}

export function validateToken(token: string) {
  const payload = verifyToken(token);
  return {valid: true, userId: payload.userId, email: payload.email};
}
