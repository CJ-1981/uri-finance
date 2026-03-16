import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Polyfill crypto.subtle for jsdom environment
// @MX:NOTE: Web Crypto API is not available in jsdom by default, so we polyfill it for tests
// This allows securePinStorage.ts to use crypto.subtle.digest() in test environment
if (typeof global.crypto === "undefined" || !global.crypto.subtle) {
  global.crypto = {
    subtle: {
      digest: async (_algorithm: string, data: Uint8Array): Promise<ArrayBuffer> => {
        // Simple mock implementation for testing
        // In production, this would use the actual Web Crypto API
        const text = new TextDecoder().decode(data);
        const mockHash = btoa(text).padEnd(64, "0").slice(0, 64);
        return new TextEncoder().encode(mockHash).buffer;
      },
    },
    randomUUID: () => "test-uuid-1234-5678-90",
    getRandomValues: (array: Uint8Array) => {
      // Simple mock for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  } as unknown as Crypto;
}
