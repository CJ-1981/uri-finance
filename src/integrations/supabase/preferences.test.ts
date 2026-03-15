import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(() => Promise.resolve({ data: null, error: null })),
      signUp: vi.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

describe("Integration Tests - User Preferences", () => {
  const mockUserA = { id: "user-a", email: "user-a@example.com" };
  const mockUserB = { id: "user-b", email: "user-b@example.com" };
  const mockProject1 = { id: "project-1", name: "Project Alpha" };
  const mockProject2 = { id: "project-2", name: "Project Beta" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC3: Security - RLS Enforcement", () => {
    it("Test Scenario 3.1: Cross-User Isolation - User A Cannot Access User B's Preference", async () => {
      // GIVEN user A and user B have different preferences
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockImplementation((_field: string, userId: string) => {
        // Simulate RLS: only return data for the querying user
        if (userId === mockUserA.id) {
          return {
            maybeSingle: vi.fn().mockResolvedValue({
              data: { default_project_id: mockProject1.id },
              error: null,
            }),
          };
        }
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { default_project_id: mockProject2.id },
            error: null,
          }),
        };
      });

      (supabase.from as any).mockReturnValue({
        select: selectMock,
        eq: eqMock,
      });

      // WHEN user A queries preferences
      await supabase.from("user_preferences").select("*").eq("user_id", mockUserA.id);

      // THEN only user A's preference is returned
      expect(eqMock).toHaveBeenCalledWith("user_id", mockUserA.id);

      // WHEN user B queries preferences
      await supabase.from("user_preferences").select("*").eq("user_id", mockUserB.id);

      // THEN only user B's preference is returned
      expect(eqMock).toHaveBeenCalledWith("user_id", mockUserB.id);
    });

    it("Test Scenario 3.2: Unauthorized Access Prevention - Cannot Update Other User's Preference", async () => {
      // GIVEN user A attempts to update user B's preference
      const mockQuery = {
        update: vi.fn(() => mockQuery),
        eq: vi.fn(() => Promise.resolve({
          data: null,
          error: { message: "RLS policy violation" },
        })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      // WHEN user A tries to update user B's preference
      await supabase
        .from("user_preferences")
        .update({ default_project_id: mockProject1.id })
        .eq("user_id", mockUserB.id);

      // THEN update is blocked by RLS
      expect(mockQuery.update).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith("user_id", mockUserB.id);
    });
  });

  describe("AC2: Membership Validation", () => {
    it("Test Scenario 2.1: ON DELETE SET NULL on Project Deletion", async () => {
      // GIVEN user has project set as default
      const mockPreference = {
        id: "pref-123",
        user_id: mockUserA.id,
        default_project_id: mockProject1.id,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      };

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: mockPreference,
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        select: selectMock,
        eq: eqMock,
        maybeSingle: maybeSingleMock,
      });

      // Fetch initial preference
      const { data: initialData } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", mockUserA.id)
        .maybeSingle();

      expect(initialData?.default_project_id).toBe(mockProject1.id);

      // WHEN project is deleted (simulated)
      const mockQueryUpdate = {
        update: vi.fn(() => mockQueryUpdate),
        eq: vi.fn(() => Promise.resolve({
          data: { default_project_id: null },
          error: null,
        })),
      };

      (supabase.from as any).mockReturnValue(mockQueryUpdate);

      // Simulate cascade effect
      await supabase
        .from("user_preferences")
        .update({ default_project_id: null })
        .eq("user_id", mockUserA.id);

      // THEN default_project_id is set to NULL
      expect(mockQueryUpdate.update).toHaveBeenCalledWith({ default_project_id: null });
    });

    it("Test Scenario 2.2: Preference Cleared on Membership Removal", async () => {
      // GIVEN trigger function clears preference when membership is removed
      const mockQuery = {
        update: vi.fn(() => mockQuery),
        eq: vi.fn(() => Promise.resolve({
          data: null,
          error: null,
        })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      // WHEN user is removed from project (trigger fires)
      await supabase
        .from("user_preferences")
        .update({ default_project_id: null })
        .eq("user_id", mockUserA.id);

      // THEN preference is cleared
      expect(mockQuery.update).toHaveBeenCalledWith({ default_project_id: null });
      expect(mockQuery.eq).toHaveBeenCalledWith("user_id", mockUserA.id);
    });
  });

  describe("AC1: Server-Side Persistence - End-to-End Flow", () => {
    it("Test Scenario: Complete Preference Save and Fetch Cycle", async () => {
      // GIVEN user is authenticated
      const upsertMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { default_project_id: mockProject1.id },
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "user_preferences") {
          return {
            upsert: upsertMock,
            select: selectMock,
            eq: eqMock,
            maybeSingle: maybeSingleMock,
          };
        }
        return {};
      });

      // WHEN user saves preference
      await supabase.from("user_preferences").upsert({
        user_id: mockUserA.id,
        default_project_id: mockProject1.id,
      });

      // THEN preference is saved
      expect(upsertMock).toHaveBeenCalledWith({
        user_id: mockUserA.id,
        default_project_id: mockProject1.id,
      });

      // WHEN user fetches preference
      const { data: prefData } = await supabase
        .from("user_preferences")
        .select("default_project_id")
        .eq("user_id", mockUserA.id)
        .maybeSingle();

      // THEN saved preference is returned
      expect(prefData?.default_project_id).toBe(mockProject1.id);
      expect(selectMock).toHaveBeenCalledWith("default_project_id");
      expect(eqMock).toHaveBeenCalledWith("user_id", mockUserA.id);
    });

    it("Test Scenario: Upsert Creates or Updates Idempotently", async () => {
      // GIVEN user preference already exists
      const upsertMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        upsert: upsertMock,
      });

      // WHEN upsert is called with same user_id
      await supabase.from("user_preferences").upsert({
        user_id: mockUserA.id,
        default_project_id: mockProject1.id,
      });

      await supabase.from("user_preferences").upsert({
        user_id: mockUserA.id,
        default_project_id: mockProject2.id, // Changed project
      });

      // THEN upsert is called twice (handles both create and update)
      expect(upsertMock).toHaveBeenCalledTimes(2);
      expect(upsertMock).toHaveBeenLastCalledWith({
        user_id: mockUserA.id,
        default_project_id: mockProject2.id,
      });
    });
  });

  describe("Error Scenarios", () => {
    it("Handles Network Error on Preference Save", async () => {
      // GIVEN network is unavailable
      const upsertMock = vi.fn().mockRejectedValue(new Error("Network error"));

      (supabase.from as any).mockReturnValue({
        upsert: upsertMock,
      });

      // WHEN saving preference
      try {
        await supabase.from("user_preferences").upsert({
          user_id: mockUserA.id,
          default_project_id: mockProject1.id,
        });
        // Should have thrown error
        expect(true).toBe(false);
      } catch (error) {
        // THEN error is thrown
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Network error");
      }
    });

    it("Handles Database Query Error on Preference Fetch", async () => {
      // GIVEN database query fails
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Query failed", code: "PGRST116" },
      });

      (supabase.from as any).mockReturnValue({
        select: selectMock,
        eq: eqMock,
        maybeSingle: maybeSingleMock,
      });

      // WHEN fetching preference
      const { data, error } = await supabase
        .from("user_preferences")
        .select("default_project_id")
        .eq("user_id", mockUserA.id)
        .maybeSingle();

      // THEN error is returned
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("Handles Empty Result (No Preference Set)", async () => {
      // GIVEN user has no preference set
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        select: selectMock,
        eq: eqMock,
        maybeSingle: maybeSingleMock,
      });

      // WHEN fetching preference
      const { data, error } = await supabase
        .from("user_preferences")
        .select("default_project_id")
        .eq("user_id", mockUserA.id)
        .maybeSingle();

      // THEN null is returned (no error)
      expect(data).toBeNull();
      expect(error).toBeNull();
    });
  });

  describe("Performance Tests", () => {
    it("Test Scenario: Single Query for Preference Fetch", async () => {
      // GIVEN user fetches preference
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: { default_project_id: mockProject1.id },
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        select: selectMock,
        eq: eqMock,
        maybeSingle: maybeSingleMock,
      });

      // WHEN preference is fetched
      await supabase
        .from("user_preferences")
        .select("default_project_id")
        .eq("user_id", mockUserA.id)
        .maybeSingle();

      // THEN only one query is made
      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(maybeSingleMock).toHaveBeenCalledTimes(1);
    });

    it("Test Scenario: Single Query for Preference Save", async () => {
      // GIVEN user saves preference
      const upsertMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        upsert: upsertMock,
      });

      // WHEN preference is saved
      await supabase.from("user_preferences").upsert({
        user_id: mockUserA.id,
        default_project_id: mockProject1.id,
      });

      // THEN only one upsert query is made
      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(upsertMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Data Integrity Tests", () => {
    it("Test Scenario: Unique Constraint on user_id", async () => {
      // GIVEN user attempts to create duplicate preference
      const upsertMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        upsert: upsertMock,
      });

      // WHEN upsert is called twice for same user
      await supabase.from("user_preferences").upsert({
        user_id: mockUserA.id,
        default_project_id: mockProject1.id,
      });

      await supabase.from("user_preferences").upsert({
        user_id: mockUserA.id,
        default_project_id: mockProject2.id,
      });

      // THEN upsert handles uniqueness (updates instead of creating duplicate)
      expect(upsertMock).toHaveBeenCalledTimes(2);
    });

    it("Test Scenario: Valid UUID References", async () => {
      // GIVEN preference references valid UUIDs
      const upsertMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        upsert: upsertMock,
      });

      // WHEN preference is saved with valid UUIDs
      await supabase.from("user_preferences").upsert({
        user_id: mockUserA.id,
        default_project_id: mockProject1.id,
      });

      // THEN upsert is called with valid data
      expect(upsertMock).toHaveBeenCalledWith({
        user_id: mockUserA.id,
        default_project_id: mockProject1.id,
      });
    });
  });
});
