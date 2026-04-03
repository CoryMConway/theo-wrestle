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
} from "./schema.js";
import { ENV } from "../env.js";

let _db: ReturnType<typeof drizzle> | null = null;

// ─── SQLite Connection ───────────────────────────────────────────────

function createTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
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
    _db = drizzle(sqlite);
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
