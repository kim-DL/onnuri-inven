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

export type InventoryCheckContext = {
  modeEnabled: boolean;
  modeSource: string | null;
  activeRunId: string | null;
  activeRunStartedAt: string | null;
  overrideMode: "AUTO" | "FORCE_ON" | "FORCE_OFF";
  autoDays: number[];
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
  checkContext: InventoryCheckContext;
  checkedProductIds: Set<string>;
};

type ProductsListSnapshot = {
  status: ProductsListStatus;
  zones: ProductsListZone[];
  products: ProductsListProduct[];
  stockByProductId: Map<string, number>;
  checkContext: InventoryCheckContext;
  checkedProductIds: Set<string>;
  error: Error | null;
  fetchedAt: number | null;
};

type ProductsListCache = ProductsListSnapshot & {
  promise: Promise<void> | null;
  requestId: number;
  listeners: Set<() => void>;
  optimisticCheckedProductIds: Set<string>;
  optimisticCheckedRunId: string | null;
};

type UseProductsListDataOptions = {
  enabled?: boolean;
};

const CACHE_TTL_MS = 60_000;
const CACHE_KEY = "__onnuriProductsListCache__" as const;
type CacheKey = typeof CACHE_KEY;

const createEmptyStockMap = () => new Map<string, number>();
const createEmptyCheckedSet = () => new Set<string>();

const DEFAULT_CHECK_CONTEXT: InventoryCheckContext = {
  modeEnabled: false,
  modeSource: null,
  activeRunId: null,
  activeRunStartedAt: null,
  overrideMode: "AUTO",
  autoDays: [],
};

type InventoryCheckContextRpcRow = {
  mode_enabled: boolean;
  mode_source: string | null;
  active_run_id: string | null;
  active_run_started_at: string | null;
  override_mode: string | null;
  auto_days: number[] | null;
};

type InventoryCheckSettingsRow = {
  override_mode: string | null;
  auto_days: number[] | null;
};

type InventoryCheckRunRow = {
  id: string;
  started_at: string | null;
  mode_source: string | null;
};

type CheckedProductRow = {
  product_id: string;
};

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
    checkContext: DEFAULT_CHECK_CONTEXT,
    checkedProductIds: createEmptyCheckedSet(),
    error: null,
    fetchedAt: null,
    promise: null,
    requestId: 0,
    listeners: new Set<() => void>(),
    optimisticCheckedProductIds: createEmptyCheckedSet(),
    optimisticCheckedRunId: null,
  });

const readSnapshot = (): ProductsListSnapshot => ({
  status: cache.status,
  zones: cache.zones,
  products: cache.products,
  stockByProductId: cache.stockByProductId,
  checkContext: cache.checkContext,
  checkedProductIds: cache.checkedProductIds,
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
  cache.stockByProductId.size > 0 ||
  cache.checkedProductIds.size > 0;

const normalizeCheckContext = (
  row: InventoryCheckContextRpcRow | null | undefined
): InventoryCheckContext => {
  if (!row) {
    return DEFAULT_CHECK_CONTEXT;
  }

  const overrideModeRaw = row.override_mode?.trim().toUpperCase();
  const overrideMode: InventoryCheckContext["overrideMode"] =
    overrideModeRaw === "FORCE_ON" || overrideModeRaw === "FORCE_OFF"
      ? overrideModeRaw
      : "AUTO";

  const autoDays = Array.isArray(row.auto_days)
    ? Array.from(
        new Set(
          row.auto_days.filter(
            (day): day is number => Number.isInteger(day) && day >= 0 && day <= 6
          )
        )
      ).sort((a, b) => a - b)
    : [];

  return {
    modeEnabled: row.mode_enabled === true && Boolean(row.active_run_id),
    modeSource: row.mode_source ?? null,
    activeRunId: row.active_run_id ?? null,
    activeRunStartedAt: row.active_run_started_at ?? null,
    overrideMode,
    autoDays,
  };
};

const shouldRefetch = () => {
  if (cache.fetchedAt === null) {
    return true;
  }
  return Date.now() - cache.fetchedAt >= CACHE_TTL_MS;
};

const fetchCheckContextWithFallback = async (): Promise<InventoryCheckContext> => {
  const rpcResult = await supabase.rpc("get_inventory_check_context");
  if (!rpcResult.error) {
    const checkContextRows =
      (rpcResult.data as InventoryCheckContextRpcRow[] | null) ?? [];
    return normalizeCheckContext(checkContextRows[0]);
  }

  const [settingsResult, activeRunResult] = await Promise.all([
    supabase
      .from("inventory_check_mode_settings")
      .select("override_mode, auto_days")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("inventory_check_runs")
      .select("id, started_at, mode_source")
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (settingsResult.error || activeRunResult.error) {
    console.warn("Failed to fetch inventory check context, fallback to default", {
      rpcError: rpcResult.error,
      settingsError: settingsResult.error,
      activeRunError: activeRunResult.error,
    });
    return DEFAULT_CHECK_CONTEXT;
  }

  const settingsRow = settingsResult.data as InventoryCheckSettingsRow | null;
  const activeRunRow = activeRunResult.data as InventoryCheckRunRow | null;

  const overrideModeRaw = settingsRow?.override_mode?.trim().toUpperCase();
  const overrideMode: InventoryCheckContext["overrideMode"] =
    overrideModeRaw === "FORCE_ON" || overrideModeRaw === "FORCE_OFF"
      ? overrideModeRaw
      : "AUTO";

  const autoDays = Array.isArray(settingsRow?.auto_days)
    ? Array.from(
        new Set(
          (settingsRow?.auto_days ?? []).filter(
            (day): day is number => Number.isInteger(day) && day >= 0 && day <= 6
          )
        )
      ).sort((a, b) => a - b)
    : [];

  return {
    modeEnabled: Boolean(activeRunRow?.id),
    modeSource:
      activeRunRow?.mode_source ??
      (overrideMode === "FORCE_OFF" ? "FORCE_OFF" : null),
    activeRunId: activeRunRow?.id ?? null,
    activeRunStartedAt: activeRunRow?.started_at ?? null,
    overrideMode,
    autoDays,
  };
};

const fetchCheckedProductIds = async (activeRunId: string) => {
  const checkedResult = await supabase.rpc("list_checked_products_for_active_run");
  if (!checkedResult.error) {
    return new Set(
      ((checkedResult.data as CheckedProductRow[] | null) ?? [])
        .map((row) => row.product_id)
        .filter(Boolean)
    );
  }

  const fallbackResult = await supabase
    .from("inventory_logs")
    .select("product_id")
    .eq("check_run_id", activeRunId);

  if (fallbackResult.error) {
    console.warn("Failed to fetch checked products, fallback to empty", {
      rpcError: checkedResult.error,
      fallbackError: fallbackResult.error,
    });
    return createEmptyCheckedSet();
  }

  return new Set(
    ((fallbackResult.data as CheckedProductRow[] | null) ?? [])
      .map((row) => row.product_id)
      .filter(Boolean)
  );
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

  const checkContext = await fetchCheckContextWithFallback();

  let checkedProductIds = createEmptyCheckedSet();
  if (checkContext.activeRunId) {
    checkedProductIds = await fetchCheckedProductIds(checkContext.activeRunId);
  }

  return {
    zones: zonesResult.data ?? [],
    products: productsResult.data ?? [],
    stockByProductId,
    checkContext,
    checkedProductIds,
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

      const nextRunId = result.checkContext.activeRunId;
      if (cache.optimisticCheckedRunId !== nextRunId) {
        cache.optimisticCheckedRunId = nextRunId;
        cache.optimisticCheckedProductIds = createEmptyCheckedSet();
      }

      const mergedCheckedProductIds = new Set(result.checkedProductIds);
      if (nextRunId && cache.optimisticCheckedRunId === nextRunId) {
        cache.optimisticCheckedProductIds.forEach((productId) => {
          mergedCheckedProductIds.add(productId);
        });
      }

      cache.zones = result.zones;
      cache.products = result.products;
      cache.stockByProductId = result.stockByProductId;
      cache.checkContext = result.checkContext;
      cache.checkedProductIds = mergedCheckedProductIds;
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

export const markProductCheckedOptimistic = (productId: string) => {
  const trimmedProductId = productId.trim();
  const activeRunId = cache.checkContext.activeRunId;
  if (!trimmedProductId || !activeRunId) {
    return;
  }

  if (cache.optimisticCheckedRunId !== activeRunId) {
    cache.optimisticCheckedRunId = activeRunId;
    cache.optimisticCheckedProductIds = createEmptyCheckedSet();
  }

  cache.optimisticCheckedProductIds.add(trimmedProductId);
  cache.checkedProductIds = new Set(cache.checkedProductIds);
  cache.checkedProductIds.add(trimmedProductId);
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
