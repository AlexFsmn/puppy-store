import {Request, Response, NextFunction} from 'express';
import jwt from 'jsonwebtoken';

// Fail fast if JWT_SECRET is not set (except in test environment)
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test-secret-do-not-use-in-production';
  }
  // Development fallback with warning
  console.warn('WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable for security.');
  return 'dev-secret-change-in-production';
})();

const JWT_ISSUER = process.env.JWT_ISSUER || 'puppy-store';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Auth mode: 'gateway' trusts Kong headers, 'standalone' validates JWT directly
const AUTH_MODE = process.env.AUTH_MODE || 'standalone';

export interface TokenPayload {
  userId: string;
  email: string;
}

// Extended payload for Kong-compatible JWTs
export interface JwtPayload extends TokenPayload {
  iss: string; // Issuer (required for Kong)
  sub: string; // Subject (user ID)
  exp: number; // Expiration
  iat: number; // Issued at
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

// Token generation (updated for Kong compatibility)
export function generateAccessToken(payload: TokenPayload): string {
  const jwtPayload: Partial<JwtPayload> = {
    ...payload,
    sub: payload.userId,
    iss: JWT_ISSUER,
  };
  return jwt.sign(jwtPayload, JWT_SECRET, {expiresIn: ACCESS_TOKEN_EXPIRY});
}

export function generateRefreshToken(payload: TokenPayload): string {
  const jwtPayload: Partial<JwtPayload> = {
    ...payload,
    sub: payload.userId,
    iss: JWT_ISSUER,
  };
  return jwt.sign(jwtPayload, JWT_SECRET, {expiresIn: REFRESH_TOKEN_EXPIRY});
}

// Token verification
export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  return {
    userId: decoded.sub || decoded.userId,
    email: decoded.email,
  };
}

export function verifyTokenSafe(token: string): TokenPayload | null {
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Extract user from JWT in gateway mode.
 * Kong already validated the token, so we just decode it (no verification needed).
 * Kong passes the Authorization header through to the service.
 */
function extractUserFromGateway(req: Request): TokenPayload | null {
  // For anonymous consumers (optional auth routes), Kong sets this header
  const isAnonymous = req.headers['x-anonymous-consumer'] === 'true';
  if (isAnonymous) {
    return null;
  }

  // Kong passes the Authorization header through - decode the JWT to get claims
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    // Use jwt.decode() not jwt.verify() - Kong already validated the signature
    const decoded = jwt.decode(token) as JwtPayload | null;

    if (!decoded) {
      return null;
    }

    return {
      userId: decoded.sub || decoded.userId,
      email: decoded.email || '',
    };
  } catch {
    return null;
  }
}

/**
 * Extract user from JWT in Authorization header (standalone mode).
 */
function extractUserFromToken(req: Request): TokenPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Middleware that requires authentication.
 * In gateway mode: trusts X-Consumer-Custom-Id header from Kong.
 * In standalone mode: validates JWT directly.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let user: TokenPayload | null = null;

  if (AUTH_MODE === 'gateway') {
    user = extractUserFromGateway(req);
  } else {
    user = extractUserFromToken(req);
  }

  if (!user) {
    res.status(401).json({error: 'Authentication required'});
    return;
  }

  req.user = user;
  next();
}

/**
 * Middleware that optionally extracts authentication.
 * Doesn't reject requests without auth, but populates req.user if present.
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (AUTH_MODE === 'gateway') {
    req.user = extractUserFromGateway(req) || undefined;
  } else {
    req.user = extractUserFromToken(req) || undefined;
  }

  next();
}

/**
 * Create auth middleware with explicit mode override.
 * Useful for testing or specific routes.
 */
export function createAuthMiddleware(mode: 'gateway' | 'standalone') {
  return {
    requireAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      let user: TokenPayload | null = null;

      if (mode === 'gateway') {
        user = extractUserFromGateway(req);
      } else {
        user = extractUserFromToken(req);
      }

      if (!user) {
        res.status(401).json({error: 'Authentication required'});
        return;
      }

      req.user = user;
      next();
    },

    optionalAuth: (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
      if (mode === 'gateway') {
        req.user = extractUserFromGateway(req) || undefined;
      } else {
        req.user = extractUserFromToken(req) || undefined;
      }

      next();
    },
  };
}
