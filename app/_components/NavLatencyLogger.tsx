"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type PendingNavigation = {
  from: string;
  to: string;
  startedAt: number;
};

const NAV_START_MARK = "nav:start";
const NAV_COMMIT_MARK = "nav:commit";
const NAV_MEASURE_NAME = "nav:latency";

function toCurrentLocation() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export default function NavLatencyLogger() {
  const pathname = usePathname();
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    const handleClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target.toLowerCase() === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) {
        return;
      }

      const from = toCurrentLocation();
      const to = `${url.pathname}${url.search}${url.hash}`;
      if (from === to) {
        return;
      }

      pendingNavigationRef.current = {
        from,
        to,
        startedAt: performance.now(),
      };

      performance.clearMarks(NAV_START_MARK);
      performance.clearMarks(NAV_COMMIT_MARK);
      performance.clearMeasures(NAV_MEASURE_NAME);
      performance.mark(NAV_START_MARK);
    };

    document.addEventListener("click", handleClickCapture, true);
    return () => {
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, []);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    if (previousPathname === pathname) {
      return;
    }

    const pendingNavigation = pendingNavigationRef.current;
    if (!pendingNavigation) {
      return;
    }

    let deltaMs = performance.now() - pendingNavigation.startedAt;
    performance.mark(NAV_COMMIT_MARK);
    performance.measure(NAV_MEASURE_NAME, NAV_START_MARK, NAV_COMMIT_MARK);
    const measureEntries = performance.getEntriesByName(NAV_MEASURE_NAME);
    const latestMeasure = measureEntries[measureEntries.length - 1];
    if (latestMeasure) {
      deltaMs = latestMeasure.duration;
    }

    const to = toCurrentLocation();
    console.table([
      {
        from: pendingNavigation.from,
        to,
        delta_ms: Number(deltaMs.toFixed(2)),
        timestamp: new Date().toISOString(),
      },
    ]);

    performance.clearMarks(NAV_START_MARK);
    performance.clearMarks(NAV_COMMIT_MARK);
    performance.clearMeasures(NAV_MEASURE_NAME);
    pendingNavigationRef.current = null;
  }, [pathname]);

  return null;
}
