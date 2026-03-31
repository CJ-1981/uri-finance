/**
 * Shared utility to detect if an error is network-related.
 */
export const isNetworkError = (error: any): boolean => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  // Normalize message to lowercase for consistent checking
  const message = error?.message?.toLowerCase() || "";
  
  return (
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("networkerror") ||
    error?.code === "PGRST100" ||
    error?.status === 0
  );
};
