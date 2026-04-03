import { ENV } from "../env.js";
import type { Request } from "express";

export function getSessionCookieOptions(req: Request) {
  const isSecure = ENV.isProduction || req.protocol === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
  };
}
