import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter, ENTRY_SUMMARY_SYSTEM_PROMPT } from "../../server/routers.js";
import type { TrpcContext } from "../../server/context.js";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("journal routes", () => {
  describe("journal.create", () => {
    it("should reject unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.journal.create({ content: "Test content" })
      ).rejects.toThrow();
    });

    it("should reject empty content", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.journal.create({ content: "" })
      ).rejects.toThrow();
    });
  });

  describe("journal.list", () => {
    it("should reject unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.journal.list()).rejects.toThrow();
    });
  });

  describe("journal.get", () => {
    it("should reject unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.journal.get({ id: 1 })).rejects.toThrow();
    });
  });

  describe("journal.delete", () => {
    it("should reject unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.journal.delete({ id: 1 })).rejects.toThrow();
    });
  });
});

describe("progression routes", () => {
  describe("progression.generate", () => {
    it("should reject unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.progression.generate()).rejects.toThrow();
    });
  });

  describe("progression.latest", () => {
    it("should reject unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.progression.latest()).rejects.toThrow();
    });
  });

  describe("progression.stats", () => {
    it("should reject unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.progression.stats()).rejects.toThrow();
    });
  });
});

describe("entry summary prompt", () => {
  it("requires structured summary sections for topics, sides, facts/logic, and self-questions", () => {
    expect(ENTRY_SUMMARY_SYSTEM_PROMPT).toContain("## Topics Wrestled With");
    expect(ENTRY_SUMMARY_SYSTEM_PROMPT).toContain("**Topic:**");
    expect(ENTRY_SUMMARY_SYSTEM_PROMPT).toContain("**Side A:**");
    expect(ENTRY_SUMMARY_SYSTEM_PROMPT).toContain("**Side B:**");
    expect(ENTRY_SUMMARY_SYSTEM_PROMPT).toContain("**Facts/Logic Noted:**");
    expect(ENTRY_SUMMARY_SYSTEM_PROMPT).toContain("**Self-Questions:**");
    expect(ENTRY_SUMMARY_SYSTEM_PROMPT).toContain("Do NOT write this as a discussion");
  });
});
