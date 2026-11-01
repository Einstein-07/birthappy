import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { getUserById, getUserForLogin } from "@/lib/repository";
import { getAuthSecretBytes } from "@/lib/secrets";
import type { User } from "@/lib/types";

const SESSION_COOKIE = "bh_session";
const SESSION_DAYS = 30;
const SESSION_ISSUER = "birthappy";
const SESSION_AUDIENCE = "birthappy-web";

export type SessionCookieOptions = {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
};

function getSessionKey() {
  return getAuthSecretBytes();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function authenticate(
  identifier: string,
  password: string
): Promise<{ user: User; needsEmailBinding: boolean } | null> {
  const user = await getUserForLogin(identifier);
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  const { passwordHash: _passwordHash, ...publicUser } = user;
  return {
    user: publicUser,
    needsEmailBinding: !publicUser.email
  };
}

export async function createSessionToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSessionKey());
}

function shouldUseSecureCookies() {
  if (process.env.AUTH_COOKIE_SECURE === "true") return true;
  if (process.env.AUTH_COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function getSessionCookie(token: string): SessionCookieOptions {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  };
}

export function getExpiredSessionCookie(): SessionCookieOptions {
  return {
    ...getSessionCookie(""),
    maxAge: 0
  };
}

async function readSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionKey(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  return getUserById(userId);
});
