import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearPin, clearLockState } from "@/lib/securePinStorage";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: { message: string } | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: { message: string } | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Initializing authentication...');

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          console.log('AuthProvider: Auth state changed', { event: _event, hasSession: !!session });
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      );

      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          console.error('AuthProvider: Get session error', error);
        } else {
          console.log('AuthProvider: Session retrieved', { hasSession: !!session });
          setSession(session);
          setUser(session?.user ?? null);
        }
        setLoading(false);
      }).catch(err => {
        console.error('AuthProvider: Session promise rejected', err);
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error('AuthProvider: Initialization error', error);
      setLoading(false);
    }
  }, []);

  const signUp = async (email: string, password: string) => {
    // Construct the email redirect URL with the correct base path
    const baseUrl = import.meta.env.VITE_BASE_URL || '/';
    const redirectTo = `${window.location.origin}${baseUrl}auth/callback`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      // Trigger preference fetch after successful sign-in (SPEC-003: Preference Restoration on Sign-In)
      // This will be handled by useProjects hook's useEffect on user change
      // The onAuthStateChange will trigger, causing useProjects to fetch projects
      // and restore the user's default project from server preferences
    }
    return { error };
  };

  const signOut = async () => {
    clearPin();
    clearLockState();
    // Clear all project-related localStorage to prevent data leakage on shared devices
    // Note: Server-side preferences in user_preferences table are NOT cleared here
    // This allows preference restoration when user signs back in on the same device
    // while maintaining security for shared device scenarios
    localStorage.removeItem("active_project_id");
    localStorage.removeItem("active_project_cache");
    localStorage.removeItem("pending_invite_code");
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      // Silently handle logout errors (e.g., 403 from expired tokens)
      // Local state is already cleared, so user is effectively logged out
      console.debug('Logout error (ignoring):', error);
    }
  };

  const resetPassword = async (email: string) => {
    const baseUrl = import.meta.env.VITE_BASE_URL || '/';
    const redirectTo = `${window.location.origin}${baseUrl}auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
