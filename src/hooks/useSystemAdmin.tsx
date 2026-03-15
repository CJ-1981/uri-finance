import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const useSystemAdmin = () => {
  const { user } = useAuth();
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  useEffect(() => {
    const SYSTEM_ADMIN_EMAILS = import.meta.env.VITE_SYSTEM_ADMIN_EMAILS?.split(",") || [];
    const userEmail = user?.email?.toLowerCase();
    setIsSystemAdmin(SYSTEM_ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail));
  }, [user?.email]);

  return { isSystemAdmin };
};
