import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
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
} from "./db";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
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

        // Trigger AI summarization in the background (don't block response)
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
          aiTags: e.aiTags ? JSON.parse(e.aiTags) as string[] : [],
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
          aiTags: entry.aiTags ? JSON.parse(entry.aiTags) as string[] : [],
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

        // Re-summarize if content changed
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

    /** Manually re-trigger AI summarization for an entry */
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
    /** Generate a new progression summary analyzing all entries */
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

      // Extract key themes
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

      // Collect all unique tags
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
          content: `You are a thoughtful theological companion helping someone process their spiritual wrestling. Your role is to:
1. Summarize the key theological questions, tensions, and insights in 2-4 sentences.
2. Identify the core themes being wrestled with.
3. Be respectful, non-judgmental, and encouraging of honest theological exploration.
4. Use language that honors the depth of the reflection without being preachy.

Respond in JSON format with this structure:
{
  "summary": "A 2-4 sentence summary of the theological wrestling...",
  "tags": ["theme1", "theme2", "theme3"]
}

The tags should be concise theological themes (e.g., "grace vs. works", "divine sovereignty", "problem of suffering", "nature of prayer").
Only return valid JSON, nothing else.`,
        },
        {
          role: "user",
          content: content,
        },
      ],
    });

    const responseContent = result.choices[0]?.message?.content;
    if (typeof responseContent !== "string") {
      throw new Error("Unexpected LLM response format");
    }

    // Try to parse JSON from the response
    let summary = "";
    let tags: string[] = [];
    try {
      // Handle potential markdown code blocks in response
      const cleaned = responseContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      summary = parsed.summary || "";
      tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    } catch {
      // If JSON parsing fails, use the raw text as summary
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
  // Build a chronological timeline of entries for the LLM
  const timeline = entries
    .map((e, i) => {
      const date = new Date(e.createdAtMs).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const title = e.title ? `"${e.title}"` : `Entry ${i + 1}`;
      const tags = e.aiTags ? JSON.parse(e.aiTags).join(", ") : "no themes extracted";
      return `--- ${title} (${date}) ---
Themes: ${tags}
Summary: ${e.aiSummary || "No summary available"}
Content excerpt: ${e.content.substring(0, 500)}${e.content.length > 500 ? "..." : ""}`;
    })
    .join("\n\n");

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a wise and empathetic theological companion analyzing someone's spiritual journey over time. You have access to their chronological journal entries about their theological wrestling.

Your task is to write a thoughtful progression analysis that:

1. **Traces the arc of their theological thinking** - How have their questions, doubts, and convictions evolved?
2. **Identifies patterns and growth** - What themes keep recurring? Where do you see deepening understanding?
3. **Notes significant shifts** - Are there moments where their thinking clearly changed direction?
4. **Highlights tensions they're holding** - What unresolved questions are they still wrestling with?
5. **Offers encouragement** - Affirm the value of honest theological wrestling without being patronizing.

Write in a warm, thoughtful tone. Use second person ("you"). Structure your response with clear sections using markdown headers. Be specific - reference their actual themes and ideas, don't be generic.

Keep the analysis between 400-800 words.`,
      },
      {
        role: "user",
        content: `Here is the chronological timeline of theological journal entries to analyze:\n\n${timeline}`,
      },
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Unexpected LLM response format");
  }
  return content;
}
