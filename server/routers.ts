import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./lib/cookies.js";
import { publicProcedure, protectedProcedure, router } from "./trpc.js";
import { z } from "zod";
import {
  createJournalEntry,
  getJournalEntriesByUser,
  getJournalEntryById,
  updateJournalEntry,
  deleteJournalEntry,
  getJournalEntryCount,
  createProgressionSummary,
  getLatestProgressionSummary,
  getProgressionSummaries,
  getUserByUsername,
  upsertUser,
  getUserByOpenId,
} from "./db/db.js";
import { invokeLLM } from "./lib/llm.js";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ENV } from "./env.js";

export const appRouter = router({
  auth: router({
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      // Never send passwordHash to the client
      const { passwordHash: _, ...safeUser } = user;
      return safeUser;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /** Register a new account with username + password */
    register: publicProcedure
      .input(
        z.object({
          username: z
            .string()
            .min(3, "Username must be at least 3 characters")
            .max(30, "Username must be at most 30 characters")
            .regex(
              /^[a-zA-Z0-9_-]+$/,
              "Username can only contain letters, numbers, hyphens, and underscores"
            ),
          password: z
            .string()
            .min(6, "Password must be at least 6 characters"),
          name: z.string().min(1, "Display name is required").max(100),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Username already taken",
          });
        }

        const passwordHash = await bcrypt.hash(input.password, 12);
        const openId = `local:${input.username}`;

        await upsertUser({
          openId,
          username: input.username,
          passwordHash,
          name: input.name,
          loginMethod: "local",
          lastSignedIn: new Date(),
        });

        const user = await getUserByOpenId(openId);
        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user",
          });
        }

        const token = jwt.sign({ openId }, ENV.cookieSecret, {
          expiresIn: "1y",
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        return {
          id: user.id,
          name: user.name,
          username: user.username,
        };
      }),

    /** Sign in with username + password */
    login: publicProcedure
      .input(
        z.object({
          username: z.string().min(1, "Username is required"),
          password: z.string().min(1, "Password is required"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByUsername(input.username);
        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No account found with that username. Please sign up first.",
          });
        }

        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Incorrect password",
          });
        }

        // Update last signed in
        await upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        const token = jwt.sign(
          { openId: user.openId },
          ENV.cookieSecret,
          { expiresIn: "1y" }
        );
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        return {
          id: user.id,
          name: user.name,
          username: user.username,
        };
      }),
  }),

  journal: router({
    /** Create a new journal entry and trigger AI summarization */
    create: protectedProcedure
      .input(
        z.object({
          content: z.string().min(1, "Content is required"),
          title: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const now = Date.now();
        const entryId = await createJournalEntry({
          userId: ctx.user.id,
          content: input.content,
          title: input.title || null,
          aiSummary: null,
          aiTags: null,
          aiStatus: "pending",
          createdAtMs: now,
          updatedAtMs: now,
        });

        // Trigger AI summarization in the background
        summarizeEntry(entryId, ctx.user.id, input.content).catch((err) =>
          console.error("[AI] Failed to summarize entry:", err)
        );

        return { id: entryId, createdAtMs: now };
      }),

    /** List all entries for the current user */
    list: protectedProcedure
      .input(
        z
          .object({
            order: z.enum(["asc", "desc"]).optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const entries = await getJournalEntriesByUser(
          ctx.user.id,
          input?.order ?? "desc"
        );
        return entries.map((e) => ({
          ...e,
          aiTags: e.aiTags ? (JSON.parse(e.aiTags) as string[]) : [],
        }));
      }),

    /** Get a single entry by ID */
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const entry = await getJournalEntryById(input.id, ctx.user.id);
        if (!entry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entry not found",
          });
        }
        return {
          ...entry,
          aiTags: entry.aiTags ? (JSON.parse(entry.aiTags) as string[]) : [],
        };
      }),

    /** Update an entry's content */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          content: z.string().min(1).optional(),
          title: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getJournalEntryById(input.id, ctx.user.id);
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entry not found",
          });
        }

        const updates: Record<string, unknown> = {
          updatedAtMs: Date.now(),
        };
        if (input.content !== undefined) updates.content = input.content;
        if (input.title !== undefined) updates.title = input.title;

        await updateJournalEntry(input.id, ctx.user.id, updates as any);

        if (input.content && input.content !== existing.content) {
          await updateJournalEntry(input.id, ctx.user.id, {
            aiStatus: "pending",
            aiSummary: null,
            aiTags: null,
            updatedAtMs: Date.now(),
          });
          summarizeEntry(input.id, ctx.user.id, input.content).catch((err) =>
            console.error("[AI] Failed to re-summarize entry:", err)
          );
        }

        return { success: true };
      }),

    /** Delete an entry */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteJournalEntry(input.id, ctx.user.id);
        return { success: true };
      }),

    /** Manually re-trigger AI summarization */
    resummarize: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const entry = await getJournalEntryById(input.id, ctx.user.id);
        if (!entry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entry not found",
          });
        }

        await updateJournalEntry(input.id, ctx.user.id, {
          aiStatus: "processing",
          updatedAtMs: Date.now(),
        });

        await summarizeEntry(input.id, ctx.user.id, entry.content);
        return { success: true };
      }),
  }),

  progression: router({
    /** Generate a new progression summary */
    generate: protectedProcedure.mutation(async ({ ctx }) => {
      const entries = await getJournalEntriesByUser(ctx.user.id, "asc");

      if (entries.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "You need at least 2 journal entries to generate a progression summary.",
        });
      }

      const progressionText = await generateProgressionAnalysis(entries);

      let keyThemes: string[] = [];
      try {
        const themesResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You extract theological themes from text. Return a JSON array of 3-7 theme strings. Only return the JSON array, nothing else.",
            },
            {
              role: "user",
              content: `Extract the key theological themes from this progression analysis:\n\n${progressionText}`,
            },
          ],
        });
        const themesContent = themesResult.choices[0]?.message?.content;
        if (typeof themesContent === "string") {
          keyThemes = JSON.parse(themesContent);
        }
      } catch {
        keyThemes = [];
      }

      const summaryId = await createProgressionSummary({
        userId: ctx.user.id,
        summary: progressionText,
        entriesAnalyzed: entries.length,
        keyThemes: JSON.stringify(keyThemes),
        createdAtMs: Date.now(),
      });

      return {
        id: summaryId,
        summary: progressionText,
        entriesAnalyzed: entries.length,
        keyThemes,
        createdAtMs: Date.now(),
      };
    }),

    /** Get the latest progression summary */
    latest: protectedProcedure.query(async ({ ctx }) => {
      const summary = await getLatestProgressionSummary(ctx.user.id);
      if (!summary) return null;
      return {
        ...summary,
        keyThemes: summary.keyThemes
          ? (JSON.parse(summary.keyThemes) as string[])
          : [],
      };
    }),

    /** Get all progression summaries */
    list: protectedProcedure.query(async ({ ctx }) => {
      const summaries = await getProgressionSummaries(ctx.user.id);
      return summaries.map((s) => ({
        ...s,
        keyThemes: s.keyThemes ? (JSON.parse(s.keyThemes) as string[]) : [],
      }));
    }),

    /** Get stats about the user's journal */
    stats: protectedProcedure.query(async ({ ctx }) => {
      const entries = await getJournalEntriesByUser(ctx.user.id, "asc");
      const entryCount = entries.length;
      const latestSummary = await getLatestProgressionSummary(ctx.user.id);

      const allTags = new Set<string>();
      entries.forEach((e) => {
        if (e.aiTags) {
          try {
            const tags = JSON.parse(e.aiTags) as string[];
            tags.forEach((t) => allTags.add(t));
          } catch {}
        }
      });

      return {
        entryCount,
        firstEntryDate: entries[0]?.createdAtMs ?? null,
        lastEntryDate: entries[entries.length - 1]?.createdAtMs ?? null,
        uniqueThemes: Array.from(allTags),
        hasProgressionSummary: !!latestSummary,
        lastProgressionDate: latestSummary?.createdAtMs ?? null,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;

// ─── AI Helper Functions ─────────────────────────────────────────────

async function summarizeEntry(
  entryId: number,
  userId: number,
  content: string
): Promise<void> {
  try {
    await updateJournalEntry(entryId, userId, {
      aiStatus: "processing",
      updatedAtMs: Date.now(),
    });

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a thoughtful theological companion. Summarize the key theological questions, tensions, and insights in 2-4 sentences and identify core themes.

Respond in JSON format:
{
  "summary": "A 2-4 sentence summary...",
  "tags": ["theme1", "theme2", "theme3"]
}

Only return valid JSON, nothing else.`,
        },
        { role: "user", content },
      ],
    });

    const responseContent = result.choices[0]?.message?.content;
    if (typeof responseContent !== "string") {
      throw new Error("Unexpected LLM response format");
    }

    let summary = "";
    let tags: string[] = [];
    try {
      const cleaned = responseContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      summary = parsed.summary || "";
      tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    } catch {
      summary = responseContent;
      tags = [];
    }

    await updateJournalEntry(entryId, userId, {
      aiSummary: summary,
      aiTags: JSON.stringify(tags),
      aiStatus: "completed",
      updatedAtMs: Date.now(),
    });
  } catch (error) {
    console.error("[AI] Summarization failed:", error);
    await updateJournalEntry(entryId, userId, {
      aiStatus: "failed",
      updatedAtMs: Date.now(),
    });
  }
}

async function generateProgressionAnalysis(
  entries: Array<{
    content: string;
    aiSummary: string | null;
    aiTags: string | null;
    createdAtMs: number;
    title: string | null;
  }>
): Promise<string> {
  const timeline = entries
    .map((e, i) => {
      const date = new Date(e.createdAtMs).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const title = e.title ? `"${e.title}"` : `Entry ${i + 1}`;
      const tags = e.aiTags
        ? JSON.parse(e.aiTags).join(", ")
        : "no themes extracted";
      return `--- ${title} (${date}) ---\nThemes: ${tags}\nSummary: ${e.aiSummary || "No summary available"}\nContent excerpt: ${e.content.substring(0, 500)}${e.content.length > 500 ? "..." : ""}`;
    })
    .join("\n\n");

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a wise theological companion analyzing someone's spiritual journey. Write a thoughtful progression analysis (400-800 words) that traces the arc of their theological thinking, identifies patterns and growth, notes significant shifts, highlights tensions, and offers encouragement. Use markdown headers and second person ("you").`,
      },
      {
        role: "user",
        content: `Here is the chronological timeline of theological journal entries:\n\n${timeline}`,
      },
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Unexpected LLM response format");
  }
  return content;
}
