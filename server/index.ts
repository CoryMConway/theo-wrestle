import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers.js";
import { ENV } from "./env.js";
import { getUserByOpenId, upsertUser, seedMockDb } from "./db/db.js";
import { COOKIE_NAME } from "../shared/const.js";
import jwt from "jsonwebtoken";
import type { TrpcContext } from "./context.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// ─── Dev Auth Bypass ─────────────────────────────────────────────────
// In development without OAuth, auto-create a dev user session
const DEV_USER_OPEN_ID = "dev-user";

if (ENV.isDemoMode) {
  seedMockDb(DEV_USER_OPEN_ID);
}

// ─── Auth Middleware Helper ──────────────────────────────────────────
async function getUserFromRequest(
  req: express.Request
): Promise<TrpcContext["user"]> {
  const token = req.cookies?.[COOKIE_NAME];

  // Demo/dev mode: auto-sign in
  if (ENV.isDemoMode && !token) {
    const user = await getUserByOpenId(DEV_USER_OPEN_ID);
    return user ?? null;
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, ENV.cookieSecret) as {
      openId: string;
    };
    const user = await getUserByOpenId(decoded.openId);
    return user ?? null;
  } catch {
    return null;
  }
}

// ─── Dev Login Route ─────────────────────────────────────────────────
app.get("/api/dev-login", async (req, res) => {
  if (!ENV.isDemoMode) {
    return res.status(404).json({ error: "Not found" });
  }

  await upsertUser({
    openId: DEV_USER_OPEN_ID,
    name: "Dev User",
    email: "dev@theowrestle.local",
    loginMethod: "local",
    role: "admin",
    lastSignedIn: new Date(),
  });

  const token = jwt.sign({ openId: DEV_USER_OPEN_ID }, ENV.cookieSecret, {
    expiresIn: "1y",
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });

  return res.redirect("/");
});

// ─── tRPC ────────────────────────────────────────────────────────────
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req, res }): Promise<TrpcContext> => {
      const user = await getUserFromRequest(req);
      return { user, req, res };
    },
  })
);

// ─── Static Files (Production) ──────────────────────────────────────
if (ENV.isProduction) {
  const clientDir = path.join(__dirname, "../../client");
  app.use(express.static(clientDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

// ─── Start ───────────────────────────────────────────────────────────
const port = ENV.port;
app.listen(port, () => {
  console.log(`[Server] TheoWrestle running on http://localhost:${port}`);
  if (ENV.isDemoMode) {
    console.log(`[Server] Demo mode — in-memory DB, auto-login enabled`);
  }
  if (!ENV.isProduction) {
    console.log(`[Server] Client dev server at http://localhost:5173`);
  }
});
