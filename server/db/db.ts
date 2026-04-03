import { eq, desc, and, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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

// ─── Local In-Memory DB ──────────────────────────────────────────────
// Used automatically when DATABASE_URL is not set (local development)

let _memoryModeLogged = false;
let mockUserIdCounter = 1;
let mockJournalEntryIdCounter = 1;
let mockProgressionSummaryIdCounter = 1;

let mockUsers: User[] = [];
let mockJournalEntries: JournalEntry[] = [];
let mockProgressionSummaries: ProgressionSummary[] = [];

function logMemoryMode() {
  if (!_memoryModeLogged) {
    console.warn(
      "[Database] No DATABASE_URL set — running with in-memory DB (data will not persist across restarts)"
    );
    _memoryModeLogged = true;
  }
}

/** Reset all in-memory data. Useful for tests. */
export function resetMockDb() {
  mockUserIdCounter = 1;
  mockJournalEntryIdCounter = 1;
  mockProgressionSummaryIdCounter = 1;
  mockUsers = [];
  mockJournalEntries = [];
  mockProgressionSummaries = [];
}

/** Seed the in-memory DB with sample data for local development. */
export function seedMockDb(userOpenId: string = "dev-user") {
  resetMockDb();

  const now = Date.now();
  const userId = mockUserIdCounter++;

  mockUsers.push({
    id: userId,
    openId: userOpenId,
    name: "Dev User",
    email: "dev@theowrestle.local",
    loginMethod: "local",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  });

  const sampleEntries = [
    {
      title: "Wrestling with the Problem of Evil",
      content:
        "Today I spent time thinking about how the existence of suffering challenges traditional theistic arguments...",
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
        "Reading Aquinas on the relationship between faith and reason...",
      aiSummary:
        "Reflection on Aquinas's view that faith and reason are complementary.",
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
        "Brain dump: I keep hearing 'grace' thrown around but what does it actually mean in different traditions?",
      aiSummary: null,
      aiTags: null,
      aiStatus: "pending" as const,
    },
  ];

  sampleEntries.forEach((entry, i) => {
    const createdAt = now - (sampleEntries.length - i) * 86400000;
    mockJournalEntries.push({
      id: mockJournalEntryIdCounter++,
      userId,
      content: entry.content,
      title: entry.title,
      aiSummary: entry.aiSummary,
      aiTags: entry.aiTags,
      aiStatus: entry.aiStatus,
      createdAtMs: createdAt,
      updatedAtMs: createdAt,
    });
  });

  console.log(
    `[Database] Seeded in-memory DB with ${sampleEntries.length} sample journal entries`
  );
}

// ─────────────────────────────────────────────────────────────────────

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
    logMemoryMode();
    const existingIndex = mockUsers.findIndex((u) => u.openId === user.openId);
    if (existingIndex !== -1) {
      const existing = mockUsers[existingIndex];
      mockUsers[existingIndex] = {
        ...existing,
        name: user.name !== undefined ? (user.name ?? null) : existing.name,
        email: user.email !== undefined ? (user.email ?? null) : existing.email,
        loginMethod:
          user.loginMethod !== undefined
            ? (user.loginMethod ?? null)
            : existing.loginMethod,
        role:
          user.role !== undefined
            ? user.role
            : user.openId === ENV.ownerOpenId
              ? "admin"
              : existing.role,
        lastSignedIn: user.lastSignedIn ?? new Date(),
        updatedAt: new Date(),
      } as User;
    } else {
      mockUsers.push({
        id: mockUserIdCounter++,
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role:
          user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: user.lastSignedIn ?? new Date(),
      });
    }
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
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

export async function getUserByOpenId(
  openId: string
): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    logMemoryMode();
    return mockUsers.find((u) => u.openId === openId);
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
  if (!db) {
    logMemoryMode();
    const newId = mockJournalEntryIdCounter++;
    mockJournalEntries.push({
      id: newId,
      userId: entry.userId,
      content: entry.content,
      title: entry.title ?? null,
      aiSummary: entry.aiSummary ?? null,
      aiTags: entry.aiTags ?? null,
      aiStatus: entry.aiStatus ?? "pending",
      createdAtMs: entry.createdAtMs ?? Date.now(),
      updatedAtMs: entry.updatedAtMs ?? Date.now(),
    });
    return newId;
  }

  const result = await db.insert(journalEntries).values(entry);
  return result[0].insertId;
}

export async function getJournalEntriesByUser(
  userId: number,
  order: "asc" | "desc" = "desc"
): Promise<JournalEntry[]> {
  const db = await getDb();
  if (!db) {
    logMemoryMode();
    const entries = mockJournalEntries.filter((e) => e.userId === userId);
    entries.sort((a, b) =>
      order === "asc"
        ? a.createdAtMs - b.createdAtMs
        : b.createdAtMs - a.createdAtMs
    );
    return entries;
  }

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
  if (!db) {
    logMemoryMode();
    return mockJournalEntries.find((e) => e.id === id && e.userId === userId);
  }

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
  const db = await getDb();
  if (!db) {
    logMemoryMode();
    const index = mockJournalEntries.findIndex(
      (e) => e.id === id && e.userId === userId
    );
    if (index !== -1) {
      mockJournalEntries[index] = {
        ...mockJournalEntries[index],
        ...updates,
      };
    }
    return;
  }

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
  if (!db) {
    logMemoryMode();
    const index = mockJournalEntries.findIndex(
      (e) => e.id === id && e.userId === userId
    );
    if (index !== -1) {
      mockJournalEntries.splice(index, 1);
    }
    return;
  }

  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
}

export async function getJournalEntryCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) {
    logMemoryMode();
    return mockJournalEntries.filter((e) => e.userId === userId).length;
  }

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
  if (!db) {
    logMemoryMode();
    const newId = mockProgressionSummaryIdCounter++;
    mockProgressionSummaries.push({
      id: newId,
      userId: summary.userId,
      summary: summary.summary,
      entriesAnalyzed: summary.entriesAnalyzed,
      keyThemes: summary.keyThemes ?? null,
      createdAtMs: summary.createdAtMs ?? Date.now(),
    });
    return newId;
  }

  const result = await db.insert(progressionSummaries).values(summary);
  return result[0].insertId;
}

export async function getLatestProgressionSummary(
  userId: number
): Promise<ProgressionSummary | null> {
  const db = await getDb();
  if (!db) {
    logMemoryMode();
    const userSummaries = mockProgressionSummaries.filter(
      (s) => s.userId === userId
    );
    if (userSummaries.length === 0) return null;
    userSummaries.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return userSummaries[0];
  }

  const result = await db
    .select()
    .from(progressionSummaries)
    .where(eq(progressionSummaries.userId, userId))
    .orderBy(desc(progressionSummaries.createdAtMs))
    .limit(1);

  return result[0] ?? null;
}

export async function getProgressionSummaries(
  userId: number
): Promise<ProgressionSummary[]> {
  const db = await getDb();
  if (!db) {
    logMemoryMode();
    const userSummaries = mockProgressionSummaries.filter(
      (s) => s.userId === userId
    );
    userSummaries.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return userSummaries;
  }

  return db
    .select()
    .from(progressionSummaries)
    .where(eq(progressionSummaries.userId, userId))
    .orderBy(desc(progressionSummaries.createdAtMs));
}
