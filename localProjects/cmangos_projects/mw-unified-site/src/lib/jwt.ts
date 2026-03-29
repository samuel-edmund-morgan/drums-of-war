import jwt from "jsonwebtoken";
import crypto from "crypto";

export interface JwtPayload {
  username: string;
  accounts: {
    classic?: number;
    tbc?: number;
    wotlk?: number;
  };
  gmlevel?: number;
}

// Use env var or generate a random secret (random is per-process, sessions won't survive restarts)
const JWT_SECRET: string =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

const COOKIE_NAME = "wow_session";
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MAX_AGE });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & {
      iat: number;
      exp: number;
    };
    return {
      username: decoded.username,
      accounts: decoded.accounts,
      gmlevel: decoded.gmlevel,
    };
  } catch {
    return null;
  }
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

export function getCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}
