import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Journal entries table - stores theological wrestling brain dumps.
 * Each entry has the raw content, an AI-generated summary, and extracted tags/themes.
 */
export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** The raw brain dump text */
  content: text("content").notNull(),
  /** Optional user-provided title */
  title: varchar("title", { length: 500 }),
  /** AI-generated summary of this entry */
  aiSummary: text("aiSummary"),
  /** AI-extracted theological themes/tags as JSON array string */
  aiTags: text("aiTags"),
  /** Status of AI processing */
  aiStatus: mysqlEnum("aiStatus", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  /** Timestamp stored as UTC milliseconds for precision */
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
});

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;

/**
 * Progression summaries - AI-generated analyses of theological growth over time.
 * These are generated on demand and cached.
 */
export const progressionSummaries = mysqlTable("progression_summaries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** The AI-generated progression analysis */
  summary: text("summary").notNull(),
  /** Number of entries analyzed when this summary was generated */
  entriesAnalyzed: int("entriesAnalyzed").notNull(),
  /** Key themes identified across entries as JSON array string */
  keyThemes: text("keyThemes"),
  /** Timestamp stored as UTC milliseconds */
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
});

export type ProgressionSummary = typeof progressionSummaries.$inferSelect;
export type InsertProgressionSummary = typeof progressionSummaries.$inferInsert;
