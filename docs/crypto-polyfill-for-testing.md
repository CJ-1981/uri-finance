# Crypto API Polyfill for Testing Environment

## Overview

This document describes the approach used to polyfill the Web Crypto API (`crypto.subtle`) for testing in jsdom environments, enabling secure PIN storage functionality to work correctly in local test runs.

## Problem Statement

The `securePinStorage.ts` module uses the Web Crypto API for secure PIN hashing:

```typescript
export const hashPin = async (value: string): Promise<string> => {
  const encoded = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
```

### The Issue

- **Browser Environment**: `crypto.subtle` is available natively in modern browsers
- **Test Environment**: Vitest uses jsdom, which does not implement the Web Crypto API
- **Result**: Tests fail with `crypto.subtle is undefined` or `crypto.subtle.digest is not a function`

### Impact on Development

Without a polyfill:
- Unit tests for PIN functionality cannot run
- Integration tests that involve PIN storage fail
- Developer workflow is blocked - cannot locally test PIN-related features

## Solution Implementation

### Polyfill Location

File: `src/test/setup.ts`

### Implementation Details

```typescript
// Polyfill crypto.subtle for jsdom environment
// @MX:NOTE: Web Crypto API is not available in jsdom by default, so we polyfill it for tests
// This allows securePinStorage.ts to use crypto.subtle.digest() in test environment
if (typeof global.crypto === "undefined" || !global.crypto.subtle) {
  global.crypto = {
    subtle: {
      digest: async (algorithm: string, data: Uint8Array): Promise<ArrayBuffer> => {
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
```

## How It Works

### 1. Detection Check

```typescript
if (typeof global.crypto === "undefined" || !global.crypto.subtle)
```

- Only applies polyfill if `crypto` doesn't exist or lacks `subtle` property
- Prevents overriding native browser implementation
- Ensures polyfill only activates in test environment

### 2. SHA-256 Digest Mock

```typescript
digest: async (algorithm: string, data: Uint8Array): Promise<ArrayBuffer> => {
  const text = new TextDecoder().decode(data);
  const mockHash = btoa(text).padEnd(64, "0").slice(0, 64);
  return new TextEncoder().encode(mockHash).buffer;
}
```

**Behavior:**
- Decodes input bytes back to text
- Creates a base64-encoded mock hash
- Pads to 64 characters (matches SHA-256 hex output length)
- Returns as ArrayBuffer to match native API signature

**Why This Approach:**
- **Deterministic**: Same input always produces same output
- **Testable**: Predictable behavior for test assertions
- **Compatible**: Returns correct types for downstream code
- **Simple**: No external dependencies required

### 3. UUID Generator Mock

```typescript
randomUUID: () => "test-uuid-1234-5678-90"
```

- Returns fixed UUID for consistent test behavior
- Enables testing of UUID-dependent functionality
- Predictable for test assertions

### 4. Random Values Mock

```typescript
getRandomValues: (array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
}
```

- Fills array with random bytes (0-255)
- Modifies array in-place (matches native API)
- Enables testing of random number generation

## Usage Examples

### Test Setup

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"], // Crypto polyfill loaded here
  },
});
```

### Test Code

```typescript
import { hashPin, storePin } from "@/lib/securePinStorage";

describe("PIN Storage Tests", () => {
  it("should hash PIN consistently", async () => {
    const hash1 = await hashPin("1234");
    const hash2 = await hashPin("1234");
    expect(hash1).toBe(hash2); // Deterministic behavior
  });

  it("should store PIN in storage", async () => {
    await storePin("1234");
    expect(sessionStorage.getItem("app_lock_pin")).toBeDefined();
  });
});
```

## Security Considerations

### ⚠️ Important Warning

**The polyfill is for TESTING ONLY and should never be used in production:**

1. **Not Cryptographically Secure**: The mock hash function is not secure
2. **Deterministic**: Same inputs produce same outputs (predictable)
3. **No Salt**: No randomization or salting applied
4. **Mock Implementation**: Base64 encoding, not actual hashing

### Production Behavior

In production environments (actual browsers):
- Native `crypto.subtle` API is used
- Real SHA-256 hashing is performed
- Cryptographically secure implementation
- **Polyfill is completely bypassed**

### Enforcement Strategies

```typescript
// 1. Environment Check
if (import.meta.env.DEV && import.meta.env.MODE === "test") {
  // Apply polyfill only in test mode
}

// 2. Module Scope
// Polyfill in test setup file only (not in production code)

// 3. Code Review
// @MX:NOTE tags clearly mark polyfill as test-only
```

## Limitations and Known Issues

### Current Limitations

1. **Algorithm Parameter Ignored**
   - Mock doesn't actually use the algorithm parameter
   - Always produces same result regardless of algorithm specified

2. **Fixed Output Format**
   - Always produces 64-character hash (matching SHA-256 hex)
   - Not suitable for testing different hash algorithms

3. **No Actual Hashing**
   - Uses base64 encoding as proxy for hashing
   - Not suitable for security testing

### When This Approach Works

✅ **Good Use Cases:**
- Unit tests for PIN storage logic
- Integration tests for authentication flow
- Testing PIN verification workflows
- Testing error handling in storage operations

❌ **Not Suitable For:**
- Security testing
- Cryptographic algorithm validation
- Performance benchmarking
- Production security features

## Maintenance Notes

### When to Update

1. **New Crypto API Usage**
   - If code uses new crypto methods, update polyfill
   - Example: New hashing algorithms, key generation

2. **Test Failures**
   - If tests fail due to crypto API changes
   - Update mock signatures to match new API

3. **Environment Changes**
   - If jsdom adds native crypto support
   - Remove or update polyfill accordingly

### Testing the Polyfill

```typescript
describe("Crypto Polyfill", () => {
  it("should provide crypto.subtle.digest", () => {
    expect(crypto.subtle).toBeDefined();
    expect(crypto.subtle.digest).toBeInstanceOf(Function);
  });

  it("should produce deterministic hashes", async () => {
    const data = new TextEncoder().encode("test");
    const hash1 = await crypto.subtle.digest("SHA-256", data);
    const hash2 = await crypto.subtle.digest("SHA-256", data);
    expect(hash1).toEqual(hash2);
  });
});
```

## Alternative Approaches

### 1. Using a Real Hashing Library

```typescript
import { sha256 } from 'crypto-hash/sha256';

// More realistic but requires additional dependency
digest: async (algorithm: string, data: Uint8Array) => {
  const hash = await sha256(data);
  return hash.buffer;
}
```

**Pros:**
- More realistic hashing behavior
- Can test different hash functions

**Cons:**
- Additional dependency
- Larger test bundle size
- Overkill for simple PIN testing

### 2. Using Node.js crypto Module

```typescript
import { createHash } from 'crypto';

// Uses actual Node.js crypto in tests
digest: async (algorithm: string, data: Uint8Array) => {
  const hash = createHash('sha256');
  hash.update(Buffer.from(data));
  return hash.digest().buffer;
}
```

**Pros:**
- Real cryptographic hashing
- More production-like behavior

**Cons:**
- Node.js specific (not browser-like)
- May not match browser behavior exactly
- Requires Node.js crypto polyfill for compatibility

### 3. Using jsdom Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost",
        resources: "usable",
      },
    },
  },
});
```

**Pros:**
- Less custom code
- Standard approach

**Cons:**
- jsdom doesn't implement Web Crypto API
- Still requires polyfill or alternative solution

## Best Practices

### 1. Isolate Test Logic

```typescript
// ✅ Good: Test behavior, not implementation
it("should verify PIN correctly", async () => {
  await storePin("1234");
  const isValid = await verifyPin("1234");
  expect(isValid).toBe(true);
});

// ❌ Bad: Test specific hash values (fragile)
it("should produce specific hash", async () => {
  const hash = await hashPin("1234");
  expect(hash).toBe("MTIzNA==00000000..."); // Implementation details
});
```

### 2. Clear Test Documentation

```typescript
/**
 * Test PIN storage with crypto polyfill
 *
 * Note: Uses crypto.subtle polyfill from src/test/setup.ts
 * @see docs/crypto-polyfill-for-testing.md
 */
describe("PIN Storage Tests", () => {
  // Tests...
});
```

### 3. Environment Guards

```typescript
// Only run crypto-dependent tests in test environment
describe("PIN Storage", () => {
  if (import.meta.env.MODE !== "test") {
    it.skip("Crypto polyfill not available in this environment");
    return;
  }

  // Actual tests...
});
```

## Troubleshooting

### Common Issues

1. **"crypto.subtle is undefined"**
   - Ensure `src/test/setup.ts` is loaded in vitest.config.ts
   - Check that `setupFiles` array includes the correct path
   - Verify polyfill condition matches your environment

2. **"crypto.subtle.digest is not a function"**
   - Check that polyfill was applied before tests run
   - Ensure no other code overwrites `global.crypto`
   - Verify test execution order

3. **Inconsistent Test Results**
   - Clear browser/vitest cache between runs
   - Check for race conditions in async operations
   - Verify polyfill isn't being called multiple times

### Debug Commands

```bash
# Run specific test file
npm test -- --run src/lib/securePinStorage.test.ts

# Run with verbose output
npm test -- --run --reporter=verbose

# Debug specific test
npm test -- --run --reporter=verbose -t "should hash PIN consistently"
```

## References

- [Web Crypto API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [SubtleCrypto.digest() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
- [Vitest Configuration](https://vitest.dev/config/)
- [jsdom Documentation](https://github.com/jsdom/jsdom)

## Version History

- **v1.0.0** (2026-03-16): Initial implementation
  - Added crypto.subtle polyfill for SHA-256 digest
  - Added randomUUID and getRandomValues mocks
  - Documented security considerations and limitations

---

**Last Updated**: 2026-03-16
**Maintainer**: Development Team
**Status**: Active ✅