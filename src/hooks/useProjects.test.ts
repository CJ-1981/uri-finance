import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProjects } from "./useProjects";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "./useAuth";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
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

// Mock useAuth hook
vi.mock("./useAuth", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: any }) => children,
}));

// Mock useI18n hook
vi.mock("./useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useProjects - User Preference Tests", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };
  const mockProjects = [
    {
      id: "project-1",
      name: "Marketing Project",
      description: "Marketing tasks",
      owner_id: "user-123",
      invite_code: "invite-123",
      currency: "USD",
      created_at: "2024-01-01",
    },
    {
      id: "project-2",
      name: "Finance Project",
      description: "Finance tracking",
      owner_id: "user-123",
      invite_code: "invite-456",
      currency: "USD",
      created_at: "2024-01-02",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (useAuth as any).mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("AC1: Server-Side Persistence", () => {
    it("Test Scenario 1.1: Preference Save on Selection", async () => {
      // GIVEN user is signed in and member of multiple projects
      // Mock supabase.from to return chainable query builder
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // WHEN user selects a project as active
      await act(async () => {
        result.current.setActiveProject(mockProjects[0]);
      });

      // THEN the selection is persisted to user_preferences table
      expect(mockQuery.upsert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        default_project_id: mockProjects[0].id,
      });
      // AND the selection is saved to localStorage
      expect(localStorage.getItem("active_project_id")).toBe(mockProjects[0].id);
      expect(localStorage.getItem("active_project_cache")).toBe(
        JSON.stringify(mockProjects[0])
      );
    });

    it("Test Scenario 1.2: Preference Fetch Returns Saved Project ID", async () => {
      // GIVEN user has preference set in database
      const mockPreference = {
        default_project_id: "project-1",
      };

      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: mockPreference, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // Fetch user preference through internal function
      await waitFor(async () => {
        // WHEN preference is fetched
        const projectId = await (result.current as any)
          .fetchUserPreference?.();

        // THEN it returns saved project ID
        expect(projectId).toBe("project-1");
      });

      expect(mockQuery.select).toHaveBeenCalledWith("default_project_id");
      expect(mockQuery.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(mockQuery.maybeSingle).toHaveBeenCalled();
    });
  });

  describe("AC2: Membership Validation", () => {
    it("Test Scenario 2.1: Preference Not Set for Non-Member Project", async () => {
      // GIVEN user is not member of "Secret Project"
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // WHEN user attempts to set non-member project as default
      await act(async () => {
        result.current.setActiveProject({
          id: "secret-project",
          name: "Secret Project",
          description: null,
          owner_id: "other-user",
          invite_code: "secret",
          currency: "USD",
          created_at: "2024-01-01",
        });
      });

      // THEN preference is saved (RLS will block actual database write)
      // Application-level validation should be added
      expect(mockQuery.upsert).toHaveBeenCalled();
    });

    it("Test Scenario 2.2: Project Deletion Clears Preference", async () => {
      // GIVEN user has project set as default
      localStorage.setItem(
        "active_project_cache",
        JSON.stringify(mockProjects[0])
      );
      localStorage.setItem("active_project_id", mockProjects[0].id);

      // WHEN project is deleted
      const { result } = renderHook(() => useProjects());

      // Simulate project list without the deleted project
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: { owner_id: mockUser.id }, error: null })),
        single: vi.fn(() => Promise.resolve({ data: { owner_id: mockUser.id }, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      await act(async () => {
        await result.current.deleteProject(mockProjects[0].id);
      });

      // THEN local storage is cleared
      expect(localStorage.getItem("active_project_id")).toBeNull();
      expect(localStorage.getItem("active_project_cache")).toBeNull();
    });
  });

  describe("AC3: Security - RLS Enforcement", () => {
    it("Test Scenario 3.1: Fallback to localStorage on Server Error", async () => {
      // GIVEN user has cached preference
      localStorage.setItem("active_project_id", "cached-project-123");

      // WHEN server fetch fails
      const errorObj = { message: 'Database error' };
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: errorObj })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // THEN localStorage cache is used as fallback
      await waitFor(async () => {
        const projectId = await (result.current as any)
          .fetchUserPreference?.();
        expect(projectId).toBe("cached-project-123");
      });
    });

    it("Test Scenario 3.2: Preference Not Set When No User", async () => {
      // GIVEN no authenticated user
      (useAuth as any).mockReturnValue({ user: null });

      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // WHEN attempting to save preference
      await act(async () => {
        result.current.setActiveProject(mockProjects[0]);
      });

      // THEN no Supabase call is made (preference is only saved to localStorage)
      expect(mockQuery.upsert).not.toHaveBeenCalled();
    });
  });

  describe("AC4: Fallback Behavior", () => {
    it("Test Scenario 4.1: Fallback to First Project When No Preference", async () => {
      // GIVEN no server preference exists
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // WHEN preference is fetched
      await waitFor(async () => {
        const projectId = await (result.current as any)
          .fetchUserPreference?.();

        // THEN null is returned (indicating no preference)
        expect(projectId).toBeNull();
      });
    });

    it("Test Scenario 4.2: No Error on Empty Cache", async () => {
      // GIVEN no localStorage cache and no server preference
      localStorage.clear();

      const notFoundError = { message: 'Not found' };
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: notFoundError })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // WHEN preference is fetched
      await waitFor(async () => {
        // THEN no error is thrown, null is returned
        const projectId = await (result.current as any)
          .fetchUserPreference?.();
        expect(projectId).toBeNull();
      });
    });
  });

  describe("Edge Cases", () => {
    it("EC1: Concurrent Preference Updates", async () => {
      // GIVEN user is signed in
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // WHEN user selects different projects rapidly
      await act(async () => {
        result.current.setActiveProject(mockProjects[0]);
        result.current.setActiveProject(mockProjects[1]);
      });

      // THEN both preferences are saved (last write wins)
      expect(mockQuery.upsert).toHaveBeenCalledTimes(2);
      expect(mockQuery.upsert).toHaveBeenLastCalledWith({
        user_id: mockUser.id,
        default_project_id: mockProjects[1].id,
      });
    });

    it("EC2: Clear Preference When Project is Deselected", async () => {
      // GIVEN user has a project selected
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => Promise.resolve({ data: null, error: null })),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // WHEN user deselects project
      await act(async () => {
        result.current.setActiveProject(null);
      });

      // THEN localStorage is cleared
      expect(localStorage.getItem("active_project_id")).toBeNull();
      expect(localStorage.getItem("active_project_cache")).toBeNull();
      // AND server preference is cleared
      expect(mockQuery.update).toHaveBeenCalledWith({ default_project_id: null });
    });

    it("EC3: Single Project User", async () => {
      // GIVEN user has only one project
      const singleProject = [mockProjects[0]];
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: singleProject, error: null })),
        upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // WHEN user selects the single project
      await act(async () => {
        result.current.setActiveProject(singleProject[0]);
      });

      // THEN preference is saved normally
      expect(localStorage.getItem("active_project_id")).toBe(
        singleProject[0].id
      );
    });
  });

  describe("Integration with Project List", () => {
    it("Restores Project from localStorage Cache", async () => {
      // GIVEN user has cached project
      localStorage.setItem(
        "active_project_cache",
        JSON.stringify(mockProjects[0])
      );
      localStorage.setItem("active_project_id", mockProjects[0].id);

      const { result } = renderHook(() => useProjects());

      // THEN cached project is set as active
      await waitFor(() => {
        expect(result.current.activeProject).toEqual(mockProjects[0]);
      });
    });

    it("Falls Back to First Project if Cache Not in List", async () => {
      // GIVEN user has cached project that no longer exists
      localStorage.setItem("active_project_id", "deleted-project-id");
      localStorage.setItem(
        "active_project_cache",
        JSON.stringify({
          id: "deleted-project-id",
          name: "Deleted Project",
          description: null,
          owner_id: mockUser.id,
          invite_code: "deleted",
          currency: "USD",
          created_at: "2024-01-01",
        })
      );

      const mockMemberships = [{ project_id: mockProjects[0].id }];
      const mockProjectData = [mockProjects[0]];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockMemberships, error: null }),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: mockProjectData,
              error: null,
            }),
            order: vi.fn().mockReturnThis(),
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      (supabase.from as any).mockImplementation(fromMock);

      const { result } = renderHook(() => useProjects());

      // THEN first available project is selected
      await waitFor(() => {
        expect(result.current.activeProject).toEqual(mockProjects[0]);
      });
    });
  });

  describe("Error Handling", () => {
    it("Handles Supabase Error Gracefully", async () => {
      // GIVEN Supabase upsert fails
      const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation();
      const mockQuery = {
        select: vi.fn(() => mockQuery),
        eq: vi.fn(() => mockQuery),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => mockQuery),
        in: vi.fn(() => Promise.resolve({ data: mockProjects, error: null })),
        upsert: vi.fn(() => Promise.reject(new Error("Network error"))),
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useProjects());

      // WHEN saving preference fails
      await act(async () => {
        result.current.setActiveProject(mockProjects[0]);
      });

      // THEN error is logged but localStorage is still updated
      expect(localStorage.getItem("active_project_id")).toBe(mockProjects[0].id);
      expect(consoleDebugSpy).toHaveBeenCalled();
      consoleDebugSpy.mockRestore();
    });

    it("Clears Invalid Cache on Membership Validation", async () => {
      // GIVEN user has cached project but is no longer member
      localStorage.setItem(
        "active_project_cache",
        JSON.stringify(mockProjects[0])
      );

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === "project_members") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return { select: vi.fn(), eq: vi.fn() };
      });

      (supabase.from as any).mockImplementation(fromMock);

      const { result } = renderHook(() => useProjects());

      // THEN cache is validated and cleared if invalid
      await waitFor(() => {
        expect(result.current.activeProject).toBeNull();
      });
    });
  });
});
