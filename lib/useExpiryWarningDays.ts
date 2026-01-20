"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ExpiryWarningStatus = "idle" | "loading" | "ready" | "error";

type ExpiryWarningSnapshot = {
  value: number;
  status: ExpiryWarningStatus;
  error: Error | null;
};

type ExpiryWarningCache = {
  value: number | null;
  status: ExpiryWarningStatus;
  error: Error | null;
  promise: Promise<number> | null;
  requestId: number;
};

const DEFAULT_EXPIRY_WARNING_DAYS = 100;

// Module cache shared across pages to avoid repeated RPC calls.
const cache: ExpiryWarningCache = {
  value: null,
  status: "idle",
  error: null,
  promise: null,
  requestId: 0,
};

const listeners = new Set<() => void>();

const readSnapshot = (): ExpiryWarningSnapshot => ({
  value: cache.value ?? DEFAULT_EXPIRY_WARNING_DAYS,
  status: cache.status,
  error: cache.error,
});

const notify = () => {
  listeners.forEach((listener) => listener());
};

const fetchExpiryWarningDays = async () => {
  const { data, error } = await supabase.rpc("get_expiry_warning_days");
  if (error) {
    throw error;
  }
  if (typeof data !== "number") {
    throw new Error("Unexpected expiry warning days payload");
  }
  return data;
};

const startFetch = () => {
  const requestId = ++cache.requestId;
  cache.status = cache.value === null ? "loading" : "ready";
  cache.error = null;

  const promise = fetchExpiryWarningDays()
    .then((value) => {
      if (requestId !== cache.requestId) {
        return value;
      }
      cache.value = value;
      cache.status = "ready";
      return value;
    })
    .catch((error) => {
      if (requestId !== cache.requestId) {
        return cache.value ?? DEFAULT_EXPIRY_WARNING_DAYS;
      }
      cache.error = error instanceof Error ? error : new Error(String(error));
      cache.status = "error";
      console.error("Failed to fetch expiry warning days", error);
      return cache.value ?? DEFAULT_EXPIRY_WARNING_DAYS;
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

const ensureExpiryWarningDays = () => {
  if (cache.promise) {
    return cache.promise;
  }
  if (cache.status !== "idle") {
    return Promise.resolve(cache.value ?? DEFAULT_EXPIRY_WARNING_DAYS);
  }
  return startFetch();
};

export const invalidateExpiryWarningDaysCache = () => {
  cache.requestId += 1;
  cache.value = null;
  cache.status = "idle";
  cache.error = null;
  cache.promise = null;
  notify();
};

export const refetchExpiryWarningDays = () => startFetch();

type UseExpiryWarningDaysOptions = {
  enabled?: boolean;
};

export const useExpiryWarningDays = (
  options: UseExpiryWarningDaysOptions = {}
) => {
  const enabled = options.enabled ?? true;
  const [snapshot, setSnapshot] = useState(readSnapshot);

  useEffect(() => {
    const handleChange = () => {
      setSnapshot(readSnapshot());
    };
    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void ensureExpiryWarningDays();
  }, [enabled]);

  const refetch = useCallback(async () => {
    if (!enabled) {
      return null;
    }
    try {
      return await refetchExpiryWarningDays();
    } catch {
      return null;
    }
  }, [enabled]);

  return {
    value: snapshot.value,
    status: snapshot.status,
    error: snapshot.error,
    refetch,
  };
};
