import { eq, desc, and, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  journalEntries,
  InsertJournalEntry,
  JournalEntry,
  progressionSummaries,
  InsertProgressionSummary,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Journal Entry Helpers ───────────────────────────────────────────

export async function createJournalEntry(
  entry: InsertJournalEntry
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(journalEntries).values(entry);
  return result[0].insertId;
}

export async function getJournalEntriesByUser(
  userId: number,
  order: "asc" | "desc" = "desc"
): Promise<JournalEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const orderFn = order === "asc" ? asc : desc;
  return db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(orderFn(journalEntries.createdAtMs));
}

export async function getJournalEntryById(
  id: number,
  userId: number
): Promise<JournalEntry | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .limit(1);

  return result[0];
}

export async function updateJournalEntry(
  id: number,
  userId: number,
  updates: Partial<
    Pick<JournalEntry, "content" | "title" | "aiSummary" | "aiTags" | "aiStatus" | "updatedAtMs">
  >
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(journalEntries)
    .set(updates)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
}

export async function deleteJournalEntry(
  id: number,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
}

export async function getJournalEntryCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId));

  return result.length;
}

// ─── Progression Summary Helpers ─────────────────────────────────────

export async function createProgressionSummary(
  summary: InsertProgressionSummary
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(progressionSummaries).values(summary);
  return result[0].insertId;
}

export async function getLatestProgressionSummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(progressionSummaries)
    .where(eq(progressionSummaries.userId, userId))
    .orderBy(desc(progressionSummaries.createdAtMs))
    .limit(1);

  return result[0] ?? null;
}

export async function getProgressionSummaries(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(progressionSummaries)
    .where(eq(progressionSummaries.userId, userId))
    .orderBy(desc(progressionSummaries.createdAtMs));
}
