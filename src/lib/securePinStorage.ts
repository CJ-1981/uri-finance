/**
 * Secure PIN Storage
 * Handles secure storage of the app PIN and lock state
 */

const PIN_STORAGE_KEY = "app_lock_pin";
const LOCK_STATE_KEY = "app_lock_state";

/**
 * Check if storage is available and accessible
 */
const isStorageAvailable = (storage: Storage): boolean => {
  try {
    const testKey = "__storage_test__";
    storage.setItem(testKey, "test");
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn(`${storage === localStorage ? 'Local' : 'Session'} storage unavailable:`, e);
    return false;
  }
};

/**
 * Check if crypto.subtle is available
 */
const isCryptoSubtleAvailable = (): boolean => {
  return typeof crypto !== "undefined" &&
         crypto !== null &&
         typeof crypto.subtle === "object";
};

/**
 * Hash PIN using SHA-256 for secure storage
 */
export const hashPin = async (value: string): Promise<string> => {
  if (!isCryptoSubtleAvailable()) {
    console.warn("crypto.subtle not available, using fallback hashing");
    // Fallback: Simple hash for non-crypto environments
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(64, "0");
  }

  try {
    const encoded = new TextEncoder().encode(value);
    const buffer = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (e) {
    console.error("Failed to hash PIN with crypto.subtle:", e);
    throw new Error("Failed to hash PIN securely");
  }
};

/**
 * Store PIN hash in both sessionStorage and localStorage for persistence
 */
export const storePin = async (pin: string): Promise<void> => {
  try {
    const hash = await hashPin(pin);

    // Try to store in both storage mechanisms
    const storageResults = [];

    if (isStorageAvailable(localStorage)) {
      try {
        localStorage.setItem(PIN_STORAGE_KEY, hash);
        storageResults.push("localStorage");
      } catch (e) {
        console.warn("Failed to store in localStorage:", e);
      }
    }

    if (isStorageAvailable(sessionStorage)) {
      try {
        sessionStorage.setItem(PIN_STORAGE_KEY, hash);
        storageResults.push("sessionStorage");
      } catch (e) {
        console.warn("Failed to store in sessionStorage:", e);
      }
    }

    if (storageResults.length === 0) {
      throw new Error("Failed to store PIN - no storage available");
    }

    console.log(`PIN stored successfully in: ${storageResults.join(", ")}`);
  } catch (error) {
    console.error("Failed to store PIN:", error);
    throw new Error("Failed to store PIN securely");
  }
};

/**
 * Retrieve and verify PIN
 */
export const verifyPin = async (input: string): Promise<boolean> => {
  try {
    // Check both session and local storage for backward compatibility
    const storedHash = sessionStorage.getItem(PIN_STORAGE_KEY) || localStorage.getItem(PIN_STORAGE_KEY);
    if (!storedHash) return false;

    const inputHash = await hashPin(input);
    return inputHash === storedHash;
  } catch (error) {
    console.error("Failed to verify PIN:", error);
    return false;
  }
};

/**
 * Clear stored PIN
 */
export const clearPin = (): boolean => {
  try {
    sessionStorage.removeItem(PIN_STORAGE_KEY);
    localStorage.removeItem(PIN_STORAGE_KEY); // Also clear local storage
    return true;
  } catch (error) {
    console.error("Failed to clear PIN:", error);
    return false;
  }
};

/**
 * Check if PIN is set
 */
export const isPinSet = (): boolean => {
  try {
    return (
      sessionStorage.getItem(PIN_STORAGE_KEY) !== null || 
      localStorage.getItem(PIN_STORAGE_KEY) !== null
    );
  } catch (error) {
    console.error("Failed to check PIN status:", error);
    return false;
  }
};

/**
 * Load lock state from sessionStorage
 */
export const loadLockState = () => {
  try {
    const raw = sessionStorage.getItem(LOCK_STATE_KEY) || localStorage.getItem(LOCK_STATE_KEY);
    if (raw) return JSON.parse(raw) as { failCount: number; blockedUntil: number };
  } catch (error) {
    console.error("Failed to load lock state:", error);
  }
  return { failCount: 0, blockedUntil: 0 };
};

/**
 * Save lock state to sessionStorage
 */
export const saveLockState = (state: { failCount: number; blockedUntil: number }) => {
  try {
    const raw = JSON.stringify(state);
    sessionStorage.setItem(LOCK_STATE_KEY, raw);
    localStorage.setItem(LOCK_STATE_KEY, raw);
  } catch (error) {
    console.error("Failed to save lock state:", error);
  }
};

/**
 * Clear lock state
 */
export const clearLockState = (): void => {
  try {
    sessionStorage.removeItem(LOCK_STATE_KEY);
    localStorage.removeItem(LOCK_STATE_KEY);
  } catch (error) {
    console.error("Failed to clear lock state:", error);
  }
};