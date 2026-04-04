import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  /** Unique username for login */
  username: text("username").unique(),
  /** bcrypt password hash */
  passwordHash: text("passwordHash"),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  /** SQLite has no enum — stored as text, validated at app level */
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Journal entries table - stores theological wrestling brain dumps.
 * Each entry has the raw content, an AI-generated summary, and extracted tags/themes.
 */
export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  /** The raw brain dump text */
  content: text("content").notNull(),
  /** Optional user-provided title */
  title: text("title"),
  /** AI-generated summary of this entry */
  aiSummary: text("aiSummary"),
  /** AI-extracted theological themes/tags as JSON array string */
  aiTags: text("aiTags"),
  /** Status of AI processing */
  aiStatus: text("aiStatus", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .default("pending")
    .notNull(),
  /** Timestamp stored as UTC milliseconds for precision */
  createdAtMs: integer("createdAtMs").notNull(),
  updatedAtMs: integer("updatedAtMs").notNull(),
});

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;

/**
 * Progression summaries - AI-generated analyses of theological growth over time.
 * These are generated on demand and cached.
 */
export const progressionSummaries = sqliteTable("progression_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  /** The AI-generated progression analysis */
  summary: text("summary").notNull(),
  /** Number of entries analyzed when this summary was generated */
  entriesAnalyzed: integer("entriesAnalyzed").notNull(),
  /** Key themes identified across entries as JSON array string */
  keyThemes: text("keyThemes"),
  /** Timestamp stored as UTC milliseconds */
  createdAtMs: integer("createdAtMs").notNull(),
});

export type ProgressionSummary = typeof progressionSummaries.$inferSelect;
export type InsertProgressionSummary = typeof progressionSummaries.$inferInsert;

/**
 * Circle requests table — tracks invitations and accepted circle memberships.
 * An accepted request IS the membership record.
 * `shareBack` controls whether the acceptor shares their content with the requester.
 */
export const circleRequests = sqliteTable("circle_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** User who sent the circle request */
  fromUserId: integer("fromUserId").notNull(),
  /** User who received the circle request */
  toUserId: integer("toUserId").notNull(),
  /** pending = awaiting response, accepted = in circle, declined = rejected */
  status: text("status", { enum: ["pending", "accepted", "declined"] })
    .default("pending")
    .notNull(),
  /** Whether the acceptor shares their content back (1 = yes, 0 = no) */
  shareBack: integer("shareBack").default(1).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type CircleRequest = typeof circleRequests.$inferSelect;
export type InsertCircleRequest = typeof circleRequests.$inferInsert;
