import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers.js";
import { ENV } from "./env.js";
import { getUserByOpenId, getDb } from "./db/db.js";
import { COOKIE_NAME } from "../shared/const.js";
import jwt from "jsonwebtoken";
import type { TrpcContext } from "./context.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Ensure database is initialized on startup
getDb();

// ─── Auth Middleware Helper ──────────────────────────────────────────
async function getUserFromRequest(
  req: express.Request
): Promise<TrpcContext["user"]> {
  const token = req.cookies?.[COOKIE_NAME];

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
  if (!ENV.isProduction) {
    console.log(`[Server] Client dev server at http://localhost:5173`);
  }
});
