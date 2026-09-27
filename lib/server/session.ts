import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AdminUser } from "./admin-users";
import { findAdminBySubject } from "./admin-users";
import { getServerConfig } from "./env";

const ISSUER = "zerdeli-urpaq";
const AUDIENCE = "zerdeli-admin";
const SESSION_SECONDS = 8 * 60 * 60;

export function sessionCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-zerdeli-admin" : "zerdeli-admin";
}

function secretKey() {
  return new TextEncoder().encode(getServerConfig().SESSION_SECRET);
}

export async function createSession(user: AdminUser) {
  const token = await new SignJWT({ role: "admin", av: user.authVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.subject)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());

  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
    priority: "high"
  });
}

export async function deleteSession() {
  (await cookies()).set(sessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentAdmin() {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE
    });
    if (payload.role !== "admin" || typeof payload.sub !== "string" || typeof payload.av !== "string") {
      return null;
    }
    const user = findAdminBySubject(payload.sub);
    if (!user || user.authVersion !== payload.av) return null;
    return { email: user.email, subject: user.subject };
  } catch {
    return null;
  }
}
