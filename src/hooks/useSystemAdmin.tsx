import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const useSystemAdmin = () => {
  const { user } = useAuth();
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  useEffect(() => {
    // Split and filter out empty/whitespace emails
    const SYSTEM_ADMIN_EMAILS = import.meta.env.VITE_SYSTEM_ADMIN_EMAILS
      ?.split(",")
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.length > 0) || [];
    const userEmail = user?.email?.toLowerCase();
    setIsSystemAdmin(SYSTEM_ADMIN_EMAILS.includes(userEmail || ""));
  }, [user?.email]);

  return { isSystemAdmin };
};
