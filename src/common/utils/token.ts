// src/common/utils/token.ts
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES = "7d";

export interface TokenPayload {
  userId: number;
  userRole: string;
}

/**
 * ✅ TEST-SAFE JWT SECRET
 * - Production MUST set JWT_SECRET
 * - Tests get a deterministic fallback
 */
export const getJwtSecret = (): string => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === "test") {
    return "TEST_JWT_SECRET_DO_NOT_USE_IN_PROD";
  }

  throw new Error(
    "JWT_SECRET is not set! Add it to .env and restart the server.",
  );
};

/**
 * ACCESS TOKEN
 */
export const signAccessToken = (
  userId: number,
  userRole?: string,
): string => {
  if (!userRole) {
    throw new Error("userRole is required to sign access token");
  }

  const payload: TokenPayload = { userId, userRole };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
};

/**
 * REFRESH TOKEN
 */
export const signRefreshToken = (
  userId: number,
  userRole?: string,
): string => {
  if (!userRole) {
    throw new Error("userRole is required to sign refresh token");
  }

  const payload: TokenPayload = { userId, userRole };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
};

/**
 * VERIFY REFRESH TOKEN
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
};
