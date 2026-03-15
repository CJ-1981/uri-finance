import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProjects } from "./useProjects";

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(() => Promise.resolve({ data: null, error: null })),
    signUp: vi.fn(() => Promise.resolve({ data: null, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
};

// Mock Supabase query builder
const mockSupabaseQuery = {
  select: vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    order: vi.fn(() => Promise.resolve({ data: [], error: null })),
    in: vi.fn(() => Promise.resolve({ data: [], error: null })),
  })),
  from: vi.fn(),
};

// Mock useAuth hook
const mockUseAuth = {
  useAuth: vi.fn(() => ({ user: null })),
};

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};

// Mock toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

describe("useProjects - Core Preference Function Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockLocalStorage.clear();
  });

  const renderProjects = () => {
    const mockProject = {
      id: "project-1",
      name: "Test Project",
      description: null,
      owner_id: "user-123",
      invite_code: "invite-123",
      currency: "USD",
      created_at: "2024-01-01",
    };

    return {
      current: {
        activeProject: null,
        setActiveProject: vi.fn(),
        fetchUserPreference: vi.fn().mockResolvedValue(null),
      },
    };
  };

  describe("Preference Save Functionality", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockLocalStorage.clear();
    });

    it("should call upsert with correct parameters when setting project", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      const mockProject = {
        id: "project-1",
        name: "Test Project",
        description: null,
        owner_id: "user-123",
        invite_code: "invite-123",
        currency: "USD",
        created_at: "2024-01-01",
      };

      const result = renderProjects();

      // WHEN user sets active project
      await act(async () => {
        result.current.setActiveProject(mockProject);
      });

      // THEN upsert is called with correct parameters
      expect(result.current.setActiveProject).toHaveBeenCalledWith(mockProject);
      expect(mockSupabaseClient.from).toHaveBeenCalled();
      expect(mockSupabaseQuery.upsert).toHaveBeenCalledWith({
        user_id: mockUser.id,
        default_project_id: mockProject.id,
      });
    });

    it("should save to localStorage when setting project", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      const mockProject = {
        id: "project-1",
        name: "Test Project",
        description: null,
        owner_id: "user-123",
        invite_code: "invite-123",
        currency: "USD",
        created_at: "2024-01-01",
      };

      const result = renderProjects();

      // WHEN user sets active project
      await act(async () => {
        result.current.setActiveProject(mockProject);
      });

      // THEN localStorage is updated
      expect(result.current.setActiveProject).toHaveBeenCalledWith(mockProject);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("active_project_id");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "active_project_cache",
        JSON.stringify(mockProject)
      );
    });

    it("should clear localStorage when setting project to null", async () => {
      const result = renderProjects();

      // WHEN user sets active project to null
      await act(async () => {
        result.current.setActiveProject(null);
      });

      // THEN localStorage is cleared
      expect(result.current.setActiveProject).toHaveBeenCalledWith(null);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("active_project_id");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("active_project_cache", "null");
    });

    it("should handle upsert errors gracefully", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      const mockProject = {
        id: "project-1",
        name: "Test Project",
        description: null,
        owner_id: "user-123",
        invite_code: "invite-123",
        currency: "USD",
        created_at: "2024-01-01",
      };

      // Mock Supabase upsert to fail
      mockSupabaseQuery.upsert.mockRejectedValue(new Error("Network error"));

      const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation();

      const result = renderProjects();
      (useAuth as any).mockReturnValue({ user: mockUser });

      // WHEN user sets active project and it fails
      await act(async () => {
        result.current.setActiveProject(mockProject);
      });

      // THEN error is logged but localStorage is still updated
      expect(consoleDebugSpy).toHaveBeenCalled();
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("active_project_id");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "active_project_cache",
        JSON.stringify(mockProject)
      );

      consoleDebugSpy.mockRestore();
    });

    it("should not save preference when user is not authenticated", async () => {
      (useAuth as any).mockReturnValue({ user: null });

      const result = renderProjects();

      const mockProject = {
        id: "project-1",
        name: "Test Project",
        description: null,
        owner_id: "user-123",
        invite_code: "invite-123",
        currency: "USD",
        created_at: "2024-01-01",
      };

      // WHEN user attempts to set project
      await act(async () => {
        result.current.setActiveProject(mockProject);
      });

      // THEN no Supabase call is made (only localStorage)
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(mockSupabaseQuery.upsert).not.toHaveBeenCalled();
    });

    it("should not save preference when user is not member of project", async () => {
      const mockUser = { id: "user-456", email: "other@example.com" };
      const mockProject = {
        id: "project-1",
        name: "Test Project",
        description: null,
        owner_id: "user-456",
        invite_code: "invite-789",
        currency: "USD",
        created_at: "2024-01-01",
      };

      // Mock Supabase query to return empty result (user not member)
      mockSupabaseQuery.maybeSingle.mockResolvedValue(null);

      (useAuth as any).mockReturnValue({ user: mockUser });

      const result = renderProjects();

      // WHEN user attempts to set project
      await act(async () => {
        result.current.setActiveProject(mockProject);
      });

      // THEN preference is not saved (RLS blocks the database write)
      expect(mockSupabaseClient.from).toHaveBeenCalled();
      expect(mockSupabaseQuery.maybeSingle).toHaveBeenCalled();
      expect(mockSupabaseQuery.upsert).not.toHaveBeenCalled();
      expect(mockLocalStorage.getItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("Security and Membership Validation", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockLocalStorage.clear();
    });

    it("should not save preference for non-member project", async () => {
      const mockUser = { id: "user-456", email: "other@example.com" };
      const mockProject = {
        id: "project-1",
        name: "Secret Project",
        description: null,
        owner_id: "other-user",
        invite_code: "secret",
        currency: "USD",
        created_at: "2024-01-01",
      };

      mockSupabaseQuery.maybeSingle.mockResolvedValue(null);
      (useAuth as any).mockReturnValue({ user: mockUser });

      const result = renderProjects();

      // WHEN user attempts to set non-member project
      await act(async () => {
        result.current.setActiveProject(mockProject);
      });

      // THEN database query returns empty (user not member)
      expect(mockSupabaseClient.from).toHaveBeenCalled();
      expect(mockSupabaseQuery.maybeSingle).toHaveBeenCalled();
      expect(mockSupabaseQuery.upsert).not.toHaveBeenCalled();
    });
  });
});
