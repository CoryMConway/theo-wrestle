import { eq, desc, and, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
  InsertUser,
  User,
  users,
  journalEntries,
  InsertJournalEntry,
  JournalEntry,
  progressionSummaries,
  InsertProgressionSummary,
  ProgressionSummary,
  circleRequests,
  CircleRequest,
} from "./schema.js";
import { ENV } from "../env.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

// ─── SQLite Connection ───────────────────────────────────────────────

function createTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      username TEXT UNIQUE,
      passwordHash TEXT,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      lastSignedIn INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      content TEXT NOT NULL,
      title TEXT,
      aiSummary TEXT,
      aiTags TEXT,
      aiStatus TEXT NOT NULL DEFAULT 'pending',
      createdAtMs INTEGER NOT NULL,
      updatedAtMs INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progression_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      summary TEXT NOT NULL,
      entriesAnalyzed INTEGER NOT NULL,
      keyThemes TEXT,
      createdAtMs INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS circle_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromUserId INTEGER NOT NULL,
      toUserId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      shareBack INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(fromUserId, toUserId)
    );
  `);
}

export function getDb() {
  if (!_db) {
    const dbPath = ENV.sqlitePath;
    console.log(`[Database] Opening SQLite database at: ${dbPath}`);
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    createTables(sqlite);
    _sqlite = sqlite;
    _db = drizzle(sqlite);

    // Periodic WAL checkpoint every 5 minutes (PASSIVE = non-blocking)
    setInterval(() => {
      try {
        sqlite.pragma("wal_checkpoint(PASSIVE)");
        console.log("[Database] Periodic WAL checkpoint completed");
      } catch (err) {
        console.error("[Database] Periodic WAL checkpoint failed:", err);
      }
    }, 5 * 60 * 1000);

    // Graceful shutdown: checkpoint + close before container dies
    const gracefulShutdown = (signal: string) => {
      console.log(`[Database] Received ${signal}, checkpointing WAL...`);
      try {
        sqlite.pragma("wal_checkpoint(TRUNCATE)");
        console.log("[Database] WAL checkpoint (TRUNCATE) completed");
        sqlite.close();
        console.log("[Database] Connection closed");
      } catch (err) {
        console.error("[Database] Shutdown checkpoint failed:", err);
      }
      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  }
  return _db;
}

/** Seed the database with a dev user and sample entries if empty. */
export function seedDb(userOpenId: string = "dev-user") {
  const db = getDb();

  // Check if user already exists
  const existing = db
    .select()
    .from(users)
    .where(eq(users.openId, userOpenId))
    .limit(1)
    .get();

  if (existing) {
    console.log(`[Database] Dev user already exists, skipping seed`);
    return;
  }

  const now = new Date();
  const nowMs = Date.now();

  // Create dev user
  db.insert(users)
    .values({
      openId: userOpenId,
      name: "Dev User",
      email: "dev@theowrestle.local",
      loginMethod: "local",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    })
    .run();

  const user = db
    .select()
    .from(users)
    .where(eq(users.openId, userOpenId))
    .limit(1)
    .get();

  if (!user) return;

  const sampleEntries = [
    {
      title: "Wrestling with the Problem of Evil",
      content:
        "Today I spent time thinking about how the existence of suffering challenges traditional theistic arguments. The classic formulation — if God is omnipotent, omniscient, and omnibenevolent, why does evil exist? — feels different when you're actually sitting with someone who's suffering versus debating it in the abstract...",
      aiSummary:
        "Explores the problem of evil through the lens of the free will defense, noting its limitations regarding natural evil.",
      aiTags: JSON.stringify([
        "theodicy",
        "free will",
        "problem of evil",
        "natural evil",
      ]),
      aiStatus: "completed" as const,
    },
    {
      title: "Faith and Reason",
      content:
        "Reading Aquinas on the relationship between faith and reason. His five ways are fascinating — the argument from motion, efficient cause, necessity, gradation, and design. What strikes me is how he saw these not as proofs that bypass faith, but as preambles to faith...",
      aiSummary:
        "Reflection on Aquinas's view that faith and reason are complementary, focusing on the Five Ways as preambles to faith rather than replacements for it.",
      aiTags: JSON.stringify([
        "Aquinas",
        "faith and reason",
        "natural theology",
      ]),
      aiStatus: "completed" as const,
    },
    {
      title: "What does grace actually mean?",
      content:
        "Brain dump: I keep hearing 'grace' thrown around but what does it actually mean in different traditions? Reformed theology emphasizes irresistible grace, Catholics talk about infused grace, and Wesleyans have prevenient grace...",
      aiSummary: null,
      aiTags: null,
      aiStatus: "pending" as const,
    },
  ];

  sampleEntries.forEach((entry, i) => {
    const createdAt = nowMs - (sampleEntries.length - i) * 86400000;
    db.insert(journalEntries)
      .values({
        userId: user.id,
        content: entry.content,
        title: entry.title,
        aiSummary: entry.aiSummary,
        aiTags: entry.aiTags,
        aiStatus: entry.aiStatus,
        createdAtMs: createdAt,
        updatedAtMs: createdAt,
      })
      .run();
  });

  console.log(
    `[Database] Seeded DB with dev user and ${sampleEntries.length} sample entries`
  );
}

// ─── User Helpers ────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = getDb();

  const updateSet: Record<string, unknown> = {};

  if (user.name !== undefined) updateSet.name = user.name ?? null;
  if (user.email !== undefined) updateSet.email = user.email ?? null;
  if (user.username !== undefined) updateSet.username = user.username ?? null;
  if (user.passwordHash !== undefined) updateSet.passwordHash = user.passwordHash ?? null;
  if (user.loginMethod !== undefined)
    updateSet.loginMethod = user.loginMethod ?? null;
  if (user.lastSignedIn !== undefined)
    updateSet.lastSignedIn = user.lastSignedIn;
  if (user.role !== undefined) {
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    updateSet.role = "admin";
  }

  updateSet.updatedAt = new Date();

  if (!user.lastSignedIn) {
    user.lastSignedIn = new Date();
  }

  db.insert(users)
    .values({
      openId: user.openId,
      username: user.username ?? null,
      passwordHash: user.passwordHash ?? null,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role:
        user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      lastSignedIn: user.lastSignedIn ?? new Date(),
    })
    .onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    })
    .run();
}

export async function getUserByOpenId(
  openId: string
): Promise<User | undefined> {
  const db = getDb();
  return db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1)
    .get();
}

export async function getUserByUsername(
  username: string
): Promise<User | undefined> {
  const db = getDb();
  return db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
    .get();
}

// ─── Journal Entry Helpers ───────────────────────────────────────────

export async function createJournalEntry(
  entry: InsertJournalEntry
): Promise<number> {
  const db = getDb();
  const result = db.insert(journalEntries).values({
    userId: entry.userId,
    content: entry.content,
    title: entry.title ?? null,
    aiSummary: entry.aiSummary ?? null,
    aiTags: entry.aiTags ?? null,
    aiStatus: entry.aiStatus ?? "pending",
    createdAtMs: entry.createdAtMs ?? Date.now(),
    updatedAtMs: entry.updatedAtMs ?? Date.now(),
  }).run();
  return Number(result.lastInsertRowid);
}

export async function getJournalEntriesByUser(
  userId: number,
  order: "asc" | "desc" = "desc"
): Promise<JournalEntry[]> {
  const db = getDb();
  const orderFn = order === "asc" ? asc : desc;
  return db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(orderFn(journalEntries.createdAtMs))
    .all();
}

export async function getJournalEntryById(
  id: number,
  userId: number
): Promise<JournalEntry | undefined> {
  const db = getDb();
  return db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .limit(1)
    .get();
}

export async function updateJournalEntry(
  id: number,
  userId: number,
  updates: Partial<
    Pick<
      JournalEntry,
      | "content"
      | "title"
      | "aiSummary"
      | "aiTags"
      | "aiStatus"
      | "updatedAtMs"
    >
  >
): Promise<void> {
  const db = getDb();
  db.update(journalEntries)
    .set(updates)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .run();
}

export async function deleteJournalEntry(
  id: number,
  userId: number
): Promise<void> {
  const db = getDb();
  db.delete(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .run();
}

export async function getJournalEntryCount(userId: number): Promise<number> {
  const db = getDb();
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .get();
  return result?.count ?? 0;
}

// ─── Progression Summary Helpers ─────────────────────────────────────

export async function createProgressionSummary(
  summary: InsertProgressionSummary
): Promise<number> {
  const db = getDb();
  const result = db.insert(progressionSummaries).values({
    userId: summary.userId,
    summary: summary.summary,
    entriesAnalyzed: summary.entriesAnalyzed,
    keyThemes: summary.keyThemes ?? null,
    createdAtMs: summary.createdAtMs ?? Date.now(),
  }).run();
  return Number(result.lastInsertRowid);
}

export async function getLatestProgressionSummary(
  userId: number
): Promise<ProgressionSummary | null> {
  const db = getDb();
  const result = db
    .select()
    .from(progressionSummaries)
    .where(eq(progressionSummaries.userId, userId))
    .orderBy(desc(progressionSummaries.createdAtMs))
    .limit(1)
    .get();
  return result ?? null;
}

export async function getProgressionSummaries(
  userId: number
): Promise<ProgressionSummary[]> {
  const db = getDb();
  return db
    .select()
    .from(progressionSummaries)
    .where(eq(progressionSummaries.userId, userId))
    .orderBy(desc(progressionSummaries.createdAtMs))
    .all();
}

// ─── Circle Helpers ──────────────────────────────────────────────────

/** Create a pending circle request from one user to another. */
export async function createCircleRequest(
  fromUserId: number,
  toUserId: number
): Promise<number> {
  const db = getDb();
  const result = db
    .insert(circleRequests)
    .values({
      fromUserId,
      toUserId,
      status: "pending",
      shareBack: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  return Number(result.lastInsertRowid);
}

/** Get all pending circle requests sent TO a user, with requester info. */
export async function getPendingRequestsForUser(
  userId: number
): Promise<Array<CircleRequest & { fromUsername: string | null; fromName: string | null }>> {
  const db = getDb();
  const rows = db
    .select({
      id: circleRequests.id,
      fromUserId: circleRequests.fromUserId,
      toUserId: circleRequests.toUserId,
      status: circleRequests.status,
      shareBack: circleRequests.shareBack,
      createdAt: circleRequests.createdAt,
      updatedAt: circleRequests.updatedAt,
      fromUsername: users.username,
      fromName: users.name,
    })
    .from(circleRequests)
    .innerJoin(users, eq(users.id, circleRequests.fromUserId))
    .where(
      and(
        eq(circleRequests.toUserId, userId),
        eq(circleRequests.status, "pending")
      )
    )
    .orderBy(desc(circleRequests.createdAt))
    .all();
  return rows;
}

/** Get pending circle requests sent BY a user (outgoing), with target info. */
export async function getSentPendingRequests(
  userId: number
): Promise<Array<CircleRequest & { toUsername: string | null; toName: string | null }>> {
  const db = getDb();
  const rows = db
    .select({
      id: circleRequests.id,
      fromUserId: circleRequests.fromUserId,
      toUserId: circleRequests.toUserId,
      status: circleRequests.status,
      shareBack: circleRequests.shareBack,
      createdAt: circleRequests.createdAt,
      updatedAt: circleRequests.updatedAt,
      toUsername: users.username,
      toName: users.name,
    })
    .from(circleRequests)
    .innerJoin(users, eq(users.id, circleRequests.toUserId))
    .where(
      and(
        eq(circleRequests.fromUserId, userId),
        eq(circleRequests.status, "pending")
      )
    )
    .orderBy(desc(circleRequests.createdAt))
    .all();
  return rows;
}

/** Count pending circle requests for a user (for badge). */
export async function getPendingRequestCount(userId: number): Promise<number> {
  const db = getDb();
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(circleRequests)
    .where(
      and(
        eq(circleRequests.toUserId, userId),
        eq(circleRequests.status, "pending")
      )
    )
    .get();
  return result?.count ?? 0;
}

/** Accept a circle request. */
export async function acceptCircleRequest(
  requestId: number,
  userId: number,
  shareBack: boolean
): Promise<void> {
  const db = getDb();
  db.update(circleRequests)
    .set({
      status: "accepted",
      shareBack: shareBack ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(circleRequests.id, requestId),
        eq(circleRequests.toUserId, userId)
      )
    )
    .run();
}

/** Decline a circle request. */
export async function declineCircleRequest(
  requestId: number,
  userId: number
): Promise<void> {
  const db = getDb();
  db.update(circleRequests)
    .set({ status: "declined", updatedAt: new Date() })
    .where(
      and(
        eq(circleRequests.id, requestId),
        eq(circleRequests.toUserId, userId)
      )
    )
    .run();
}

/**
 * Get all circle members for a user.
 * A "member" is someone with an accepted circle request in either direction.
 * Returns info about each member and whether they share their content.
 */
export async function getCircleMembers(
  userId: number
): Promise<
  Array<{
    id: number;
    username: string | null;
    name: string | null;
    sharesWithYou: boolean;
    youShareWithThem: boolean;
  }>
> {
  const db = getDb();

  // Requests I sent that were accepted → I can see their content if shareBack=1
  const sentAccepted = db
    .select({
      memberId: circleRequests.toUserId,
      shareBack: circleRequests.shareBack,
    })
    .from(circleRequests)
    .where(
      and(
        eq(circleRequests.fromUserId, userId),
        eq(circleRequests.status, "accepted")
      )
    )
    .all();

  // Requests I received that I accepted → they can always see my content (I accepted their request)
  const receivedAccepted = db
    .select({
      memberId: circleRequests.fromUserId,
      shareBack: circleRequests.shareBack,
    })
    .from(circleRequests)
    .where(
      and(
        eq(circleRequests.toUserId, userId),
        eq(circleRequests.status, "accepted")
      )
    )
    .all();

  // Build a map of member info
  const memberMap = new Map<
    number,
    { sharesWithYou: boolean; youShareWithThem: boolean }
  >();

  // For requests I sent: the recipient always sees my content (I initiated sharing).
  // I see their content only if they set shareBack=1.
  for (const r of sentAccepted) {
    const existing = memberMap.get(r.memberId) || {
      sharesWithYou: false,
      youShareWithThem: false,
    };
    existing.sharesWithYou = r.shareBack === 1;
    existing.youShareWithThem = true; // I sent the request = I share with them
    memberMap.set(r.memberId, existing);
  }

  // For requests I received: I always share if there's an accepted request from them.
  // They share with me = always true (they initiated).
  for (const r of receivedAccepted) {
    const existing = memberMap.get(r.memberId) || {
      sharesWithYou: false,
      youShareWithThem: false,
    };
    existing.sharesWithYou = true; // They initiated = they share with me
    existing.youShareWithThem = r.shareBack === 1; // I share back only if I opted in
    memberMap.set(r.memberId, existing);
  }

  if (memberMap.size === 0) return [];

  // Fetch user info for all members
  const memberIds = Array.from(memberMap.keys());
  const memberUsers = db
    .select({ id: users.id, username: users.username, name: users.name })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`)
    .all();

  return memberUsers.map((u) => {
    const info = memberMap.get(u.id)!;
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      sharesWithYou: info.sharesWithYou,
      youShareWithThem: info.youShareWithThem,
    };
  });
}

/** Remove a circle member (deletes requests in both directions). */
export async function removeCircleMember(
  userId: number,
  memberId: number
): Promise<void> {
  const db = getDb();
  // Delete request from me to them
  db.delete(circleRequests)
    .where(
      and(
        eq(circleRequests.fromUserId, userId),
        eq(circleRequests.toUserId, memberId)
      )
    )
    .run();
  // Delete request from them to me
  db.delete(circleRequests)
    .where(
      and(
        eq(circleRequests.fromUserId, memberId),
        eq(circleRequests.toUserId, userId)
      )
    )
    .run();
}

/** Check if an existing request exists between two users (any direction, any status). */
export async function getExistingCircleRequest(
  userA: number,
  userB: number
): Promise<CircleRequest | undefined> {
  const db = getDb();
  return db
    .select()
    .from(circleRequests)
    .where(
      sql`(${circleRequests.fromUserId} = ${userA} AND ${circleRequests.toUserId} = ${userB})
        OR (${circleRequests.fromUserId} = ${userB} AND ${circleRequests.toUserId} = ${userA})`
    )
    .limit(1)
    .get();
}

/**
 * Check if userId can view memberId's content.
 * True if there's an accepted request where memberId shares with userId.
 */
export async function canViewMemberContent(
  userId: number,
  memberId: number
): Promise<boolean> {
  const db = getDb();

  // Case 1: I sent a request to them, they accepted with shareBack=1
  const sentReq = db
    .select()
    .from(circleRequests)
    .where(
      and(
        eq(circleRequests.fromUserId, userId),
        eq(circleRequests.toUserId, memberId),
        eq(circleRequests.status, "accepted"),
        eq(circleRequests.shareBack, 1)
      )
    )
    .limit(1)
    .get();
  if (sentReq) return true;

  // Case 2: They sent a request to me, accepted = they always share
  const receivedReq = db
    .select()
    .from(circleRequests)
    .where(
      and(
        eq(circleRequests.fromUserId, memberId),
        eq(circleRequests.toUserId, userId),
        eq(circleRequests.status, "accepted")
      )
    )
    .limit(1)
    .get();
  if (receivedReq) return true;

  return false;
}

/** Get journal entries for a specific user (for circle member viewing). */
export async function getJournalEntriesByUserId(
  userId: number,
  order: "asc" | "desc" = "desc",
  limit?: number
): Promise<JournalEntry[]> {
  const db = getDb();
  const orderFn = order === "asc" ? asc : desc;
  let query = db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(orderFn(journalEntries.createdAtMs));
  if (limit) {
    query = query.limit(limit) as typeof query;
  }
  return query.all();
}

/** Get recent entries from multiple users (for circle feed). */
export async function getRecentCircleEntries(
  memberIds: number[],
  limit: number = 10
): Promise<Array<JournalEntry & { username: string | null; memberName: string | null }>> {
  if (memberIds.length === 0) return [];
  const db = getDb();
  const rows = db
    .select({
      id: journalEntries.id,
      userId: journalEntries.userId,
      content: journalEntries.content,
      title: journalEntries.title,
      aiSummary: journalEntries.aiSummary,
      aiTags: journalEntries.aiTags,
      aiStatus: journalEntries.aiStatus,
      createdAtMs: journalEntries.createdAtMs,
      updatedAtMs: journalEntries.updatedAtMs,
      username: users.username,
      memberName: users.name,
    })
    .from(journalEntries)
    .innerJoin(users, eq(users.id, journalEntries.userId))
    .where(sql`${journalEntries.userId} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(desc(journalEntries.createdAtMs))
    .limit(limit)
    .all();
  return rows;
}
