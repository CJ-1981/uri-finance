import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { QueryClient } from "@tanstack/react-query";
import { get, set, del } from "idb-keyval";

/**
 * Creates an IndexedDB persister for TanStack Query.
 * This allows the cache to survive page reloads and function offline.
 */
export const createIndexedDBPersister = (idbKey: string = "react-query-cache") => {
  return {
    persistClient: async (persistClient: any) => {
      await set(idbKey, persistClient);
    },
    restoreClient: async () => {
      return await get(idbKey);
    },
    removeClient: async () => {
      await del(idbKey);
    },
  };
};

export const queryPersister = createIndexedDBPersister();

export const configurePersistence = (queryClient: QueryClient) => {
  persistQueryClient({
    queryClient,
    persister: queryPersister,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    buster: __APP_VERSION__ || "1.0.0", // Invalidate cache on app version change
  });
};
