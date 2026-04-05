import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRightLeft } from "lucide-react";

/**
 * Auth Callback Handler
 *
 * This component handles the Supabase authentication callback when users
 * click links from confirmation emails. It processes the hash fragment
 * (e.g., #access_token=...) and completes the auth flow.
 *
 * Supabase automatically detects session tokens in the URL hash and
 * processes them when the client is initialized. This component monitors
 * the auth state change and redirects users appropriately.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { disableStandaloneMode } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    console.log('AuthCallback: Component mounted, processing auth hash...');

    // Check if there's an access_token in the hash OR a code in the query (PKCE)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    
    const type = hashParams.get('type') || searchParams.get('type');
    const isRecovery = type === 'recovery';
    
    const hasAccessToken = hashParams.has('access_token');
    const hasCode = searchParams.has('code');
    const hasError = hashParams.has('error') || searchParams.has('error');

    console.log('AuthCallback: Params detection', {
      hasAccessToken,
      hasCode,
      hasError,
      isRecovery,
      hashLength: window.location.hash.length,
      search: window.location.search
    });

    if (hasError) {
      const errorMessage = hashParams.get('error_description') || 
                           searchParams.get('error_description') || 
                           hashParams.get('error') || 
                           searchParams.get('error') || 
                           'Unknown error';
      setError(errorMessage);
      setProcessing(false);
      return;
    }

    // Supabase client automatically processes the hash fragment
    // We use a retry mechanism to wait for the session to be established
    let retryCount = 0;
    const maxRetries = 10; // Up to 10 seconds

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('AuthCallback: Session check error', error);
          setError(error.message);
          setProcessing(false);
          return;
        }

        if (session) {
          console.log('AuthCallback: Session established, redirecting to dashboard');
          // If we have a real session, ensure standalone mode is off
          disableStandaloneMode();
          // Clear hash/query to avoid re-processing
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/', { replace: true });
          return;
        } 
        
        if (!hasAccessToken && !hasCode) {
          // No auth credentials (token or code) and no session - redirect to auth page
          console.log('AuthCallback: No auth credentials found, redirecting to auth page');
          navigate('/auth', { replace: true });
          return;
        }

        // Credentials are present but session not yet established - retry
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`AuthCallback: [V3-PKCE] Still processing (retry ${retryCount}/${maxRetries})...`);
          setTimeout(checkSession, 1000); // Check again in 1 second
        } else {
          console.log('AuthCallback: Authentication verification timed out');
          setError('Authentication timed out. Please try logging in again.');
          setProcessing(false);
        }
      } catch (err) {
        console.error('AuthCallback: Unexpected error', err);
        setError('An unexpected error occurred');
        setProcessing(false);
      }
    };

    checkSession();

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('AuthCallback: Auth state changed', { event, hasSession: !!session });

        if (event === 'SIGNED_IN' && session) {
          console.log('AuthCallback: User signed in, redirecting...');
          // If we have a real session, ensure standalone mode is off
          disableStandaloneMode();
          setProcessing(false);
          // Clear the hash to avoid re-processing
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/', { replace: true });
        } else if (event === 'SIGNED_OUT') {
          console.log('AuthCallback: User signed out');
          setProcessing(false);
          navigate('/auth', { replace: true });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, disableStandaloneMode]);

  // Show loading state while Supabase processes the auth hash
  if (processing && !error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary animate-pulse">
            <ArrowRightLeft className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Verifying your email...
          </h1>
          <p className="text-sm text-muted-foreground">
            Please wait while we confirm your account.
          </p>
        </div>
      </div>
    );
  }

  // Show error state if something went wrong
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <ArrowRightLeft className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Authentication Error
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {error}
          </p>
          <button
            onClick={() => navigate('/auth', { replace: true })}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Should not reach here - but redirect to auth page just in case
  return null;
};

export default AuthCallback;
