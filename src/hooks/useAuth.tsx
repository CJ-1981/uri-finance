import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearPin, clearLockState } from "@/lib/securePinStorage";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isStandalone: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  enableStandaloneMode: () => void;
  disableStandaloneMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStandaloneUser = (): User => ({
  id: "standalone-user",
  email: "standalone@local",
  app_metadata: {},
  user_metadata: { full_name: "Standalone User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
  role: "authenticated",
  updated_at: new Date().toISOString(),
  phone: "",
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  identities: [],
  factors: [],
});

// Helper to build normalized redirect URL for auth emails
const buildAuthRedirectUrl = () => {
  const rawBaseUrl = import.meta.env.BASE_URL || '/';
  const baseUrl = rawBaseUrl.startsWith('/') ? rawBaseUrl : `/${rawBaseUrl}`;
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${window.location.origin}${normalizedBaseUrl}auth/callback`;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStandalone, setIsStandalone] = useState(() => localStorage.getItem("is_standalone") === "true");

  useEffect(() => {
    console.log('AuthProvider: Initializing authentication...', { isStandalone });

    if (isStandalone) {
      setUser(getStandaloneUser());
      setLoading(false);
      return;
    } else if (user?.id === "standalone-user") {
      // Clear mock user if standalone mode is disabled
      setUser(null);
    }

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
  }, [isStandalone]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildAuthRedirectUrl(),
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
    localStorage.removeItem("active_project_id");
    localStorage.removeItem("active_project_cache");
    localStorage.removeItem("pending_invite_code");
    localStorage.removeItem("is_standalone");
    
    // Aggressively clear all Supabase-related keys from localStorage to prevent re-login while offline
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Explicitly clear state first to ensure immediate UI update
    setSession(null);
    setUser(null);
    setIsStandalone(false);

    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.debug('Logout error (ignoring):', error);
    }
  };

  const enableStandaloneMode = () => {
    localStorage.setItem("is_standalone", "true");
    setIsStandalone(true);
    setUser(getStandaloneUser());
  };

  const disableStandaloneMode = () => {
    localStorage.removeItem("is_standalone");
    setIsStandalone(false);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildAuthRedirectUrl(),
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
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      isStandalone, 
      signUp, 
      signIn, 
      signOut, 
      resetPassword, 
      updatePassword,
      enableStandaloneMode,
      disableStandaloneMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
