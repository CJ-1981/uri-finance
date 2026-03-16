# Crypto API Polyfill - Quick Reference

## What

Polyfill for Web Crypto API (`crypto.subtle`) in jsdom test environment.

## Why

`securePinStorage.ts` uses `crypto.subtle.digest("SHA-256")` which isn't available in jsdom.

## Where

**File**: `src/test/setup.ts`

## How It Works

```typescript
if (typeof global.crypto === "undefined" || !global.crypto.subtle) {
  global.crypto = {
    subtle: {
      digest: async (algorithm, data) => {
        const text = new TextDecoder().decode(data);
        const mockHash = btoa(text).padEnd(64, "0").slice(0, 64);
        return new TextEncoder().encode(mockHash).buffer;
      },
    },
    randomUUID: () => "test-uuid-1234-5678-90",
    getRandomValues: (array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  } as unknown as Crypto;
}
```

## When Used

✅ **Test Environment Only**
- Unit tests for PIN storage
- Integration tests for auth flow
- Any test needing `crypto.subtle`

❌ **Never in Production**
- Browser has native API
- Polyfill bypassed automatically
- Not cryptographically secure

## Testing PIN Features

```bash
# Run all PIN tests
npm test -- --run src/lib/securePinStorage.test.ts src/components/PinSetupDialog.test.tsx

# Run specific test
npm test -- --run -t "should hash PIN consistently"
```

## Test Example

```typescript
import { hashPin, storePin, verifyPin } from "@/lib/securePinStorage";

describe("PIN Tests", () => {
  it("should hash PIN consistently", async () => {
    const hash1 = await hashPin("1234");
    const hash2 = await hashPin("1234");
    expect(hash1).toBe(hash2); // Deterministic polyfill
  });

  it("should store and verify PIN", async () => {
    await storePin("1234");
    const isValid = await verifyPin("1234");
    expect(isValid).toBe(true);
  });
});
```

## Key Points

1. **Deterministic**: Same input → Same output (good for tests)
2. **Simple Mock**: Base64 encoding, not real SHA-256
3. **Test Only**: Never used in production
4. **Compatible**: Returns correct types for existing code

## Troubleshooting

**Problem**: `crypto.subtle is undefined`

**Solution**: Check that `src/test/setup.ts` is loaded in `vitest.config.ts`

**Problem**: Inconsistent test results

**Solution**: Clear vitest cache and ensure polyfill is loaded before tests run

## Full Documentation

For detailed information, see [Crypto API Polyfill for Testing](./crypto-polyfill-for-testing.md)

---

**Quick Reference**: Crypto Polyfill | Last Updated: 2026-03-16
**Status**: Active ✅ | **Maintainer**: Development Team