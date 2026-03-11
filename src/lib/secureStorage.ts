/**
 * Secure Storage Adapter
 * Provides a more secure alternative to localStorage for sensitive data.
 * Uses sessionStorage which clears when the browser tab is closed.
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Secure storage implementation using sessionStorage
 * This is more secure than localStorage as it:
 * - Clears data when browser tab closes
 * - Is not accessible across tabs
 * - Reduces XSS attack surface
 */
class SecureStorageAdapter implements StorageAdapter {
  private prefix: string;

  constructor(prefix: string = 'secure_') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  getItem(key: string): string | null {
    try {
      const prefixedKey = this.getKey(key);
      return sessionStorage.getItem(prefixedKey);
    } catch (error) {
      console.error('SecureStorage getItem error:', error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      const prefixedKey = this.getKey(key);
      sessionStorage.setItem(prefixedKey, value);
    } catch (error) {
      console.error('SecureStorage setItem error:', error);
    }
  }

  removeItem(key: string): void {
    try {
      const prefixedKey = this.getKey(key);
      sessionStorage.removeItem(prefixedKey);
    } catch (error) {
      console.error('SecureStorage removeItem error:', error);
    }
  }
}

/**
 * Create a secure storage instance
 */
export const createSecureStorage = (prefix?: string): StorageAdapter => {
  return new SecureStorageAdapter(prefix);
};

/**
 * Default secure storage instance for Supabase auth
 */
export const secureAuthStorage = createSecureStorage('auth_');