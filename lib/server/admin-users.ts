import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getServerConfig } from "./env";

const userSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  passwordHash: z.string().regex(/^\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/)
});

export type AdminUser = z.infer<typeof userSchema> & { subject: string; authVersion: string };

let cachedUsers: AdminUser[] | undefined;

export function getAdminUsers(): AdminUser[] {
  if (cachedUsers) return cachedUsers;
  const raw = JSON.parse(getServerConfig().ADMIN_USERS_JSON) as unknown;
  const users = z.array(userSchema).min(1).parse(raw);
  const seen = new Set<string>();
  cachedUsers = users.map((user) => {
    if (seen.has(user.email)) throw new Error("DUPLICATE_ADMIN_EMAIL");
    seen.add(user.email);
    return {
      ...user,
      subject: digest(user.email),
      authVersion: digest(user.passwordHash).slice(0, 24)
    };
  });
  return cachedUsers;
}

export function findAdminByEmail(email: string) {
  return getAdminUsers().find((user) => user.email === email.trim().toLowerCase());
}

export function findAdminBySubject(subject: string) {
  return getAdminUsers().find((user) => user.subject === subject);
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
