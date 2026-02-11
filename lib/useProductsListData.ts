"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type ProductsListZone = {
  id: string;
  name: string;
};

export type ProductsListProduct = {
  id: string;
  name: string;
  manufacturer: string | null;
  zone_id: string | null;
  expiry_date: string | null;
  photo_url: string | null;
  unit: string | null;
};

type InventoryRow = {
  product_id: string;
  stock: number;
};

type ProductsListStatus = "idle" | "loading" | "ready" | "error";

type ProductsListFetchResult = {
  zones: ProductsListZone[];
  products: ProductsListProduct[];
  stockByProductId: Map<string, number>;
};

type ProductsListSnapshot = {
  status: ProductsListStatus;
  zones: ProductsListZone[];
  products: ProductsListProduct[];
  stockByProductId: Map<string, number>;
  error: Error | null;
  fetchedAt: number | null;
};

type ProductsListCache = ProductsListSnapshot & {
  promise: Promise<void> | null;
  requestId: number;
  listeners: Set<() => void>;
};

type UseProductsListDataOptions = {
  enabled?: boolean;
};

const CACHE_TTL_MS = 60_000;
const CACHE_KEY = "__onnuriProductsListCache__" as const;
type CacheKey = typeof CACHE_KEY;

const createEmptyStockMap = () => new Map<string, number>();

// Global cache shared across route transitions to avoid repeat list fetches.
const globalScope = globalThis as typeof globalThis & {
  [key in CacheKey]?: ProductsListCache;
};

const cache =
  globalScope[CACHE_KEY] ??
  (globalScope[CACHE_KEY] = {
    status: "idle",
    zones: [],
    products: [],
    stockByProductId: createEmptyStockMap(),
    error: null,
    fetchedAt: null,
    promise: null,
    requestId: 0,
    listeners: new Set<() => void>(),
  });

const readSnapshot = (): ProductsListSnapshot => ({
  status: cache.status,
  zones: cache.zones,
  products: cache.products,
  stockByProductId: cache.stockByProductId,
  error: cache.error,
  fetchedAt: cache.fetchedAt,
});

const notify = () => {
  cache.listeners.forEach((listener) => listener());
};

const hasRenderableSnapshot = () =>
  cache.fetchedAt !== null ||
  cache.products.length > 0 ||
  cache.zones.length > 0 ||
  cache.stockByProductId.size > 0;

const shouldRefetch = () => {
  if (cache.fetchedAt === null) {
    return true;
  }
  return Date.now() - cache.fetchedAt >= CACHE_TTL_MS;
};

const fetchProductsListData = async (): Promise<ProductsListFetchResult> => {
  const [zonesResult, productsResult, inventoryResult] = await Promise.all([
    supabase.from("zones").select("id, name").order("sort_order"),
    supabase
      .from("products")
      .select("id, name, manufacturer, zone_id, expiry_date, photo_url, unit")
      .eq("active", true)
      .order("name"),
    supabase.from("inventory").select("product_id, stock"),
  ]);

  if (zonesResult.error || productsResult.error || inventoryResult.error) {
    if (zonesResult.error) {
      console.error("Failed to fetch zones", zonesResult.error);
    }
    if (productsResult.error) {
      console.error("Failed to fetch products", productsResult.error);
    }
    if (inventoryResult.error) {
      console.error("Failed to fetch inventory", inventoryResult.error);
    }
    throw new Error("Failed to fetch products list data");
  }

  const stockByProductId = createEmptyStockMap();
  (inventoryResult.data as InventoryRow[] | null | undefined)?.forEach((row) => {
    stockByProductId.set(row.product_id, row.stock);
  });

  return {
    zones: zonesResult.data ?? [],
    products: productsResult.data ?? [],
    stockByProductId,
  };
};

const startFetch = () => {
  if (cache.promise) {
    return cache.promise;
  }

  const requestId = ++cache.requestId;
  cache.error = null;
  cache.status = hasRenderableSnapshot() ? "ready" : "loading";

  const promise = fetchProductsListData()
    .then((result) => {
      if (requestId !== cache.requestId) {
        return;
      }
      cache.zones = result.zones;
      cache.products = result.products;
      cache.stockByProductId = result.stockByProductId;
      cache.fetchedAt = Date.now();
      cache.status = "ready";
    })
    .catch((error) => {
      if (requestId !== cache.requestId) {
        return;
      }

      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      console.error("Failed to fetch products list data", normalizedError);

      if (hasRenderableSnapshot()) {
        cache.status = "ready";
        cache.error = null;
        return;
      }

      cache.status = "error";
      cache.error = normalizedError;
    })
    .finally(() => {
      if (requestId !== cache.requestId) {
        return;
      }
      cache.promise = null;
      notify();
    });

  cache.promise = promise;
  notify();
  return promise;
};

const ensureProductsListData = () => {
  if (cache.promise) {
    return cache.promise;
  }
  if (hasRenderableSnapshot() && !shouldRefetch()) {
    return Promise.resolve();
  }
  return startFetch();
};

export const invalidateProductsListDataCache = () => {
  cache.requestId += 1;
  cache.promise = null;
  cache.fetchedAt = null;
  cache.error = null;
  cache.status = hasRenderableSnapshot() ? "ready" : "idle";
  notify();
};

export const useProductsListData = (
  options: UseProductsListDataOptions = {}
) => {
  const enabled = options.enabled ?? true;
  const [snapshot, setSnapshot] = useState(readSnapshot);

  useEffect(() => {
    const handleChange = () => {
      setSnapshot(readSnapshot());
    };
    cache.listeners.add(handleChange);
    return () => {
      cache.listeners.delete(handleChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void ensureProductsListData();
  }, [enabled]);

  const refetch = useCallback(async () => {
    if (!enabled) {
      return;
    }
    await startFetch();
  }, [enabled]);

  return {
    ...snapshot,
    refetch,
  };
};
