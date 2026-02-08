"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type DelayedFallbackProps = {
  ms?: number;
  children: ReactNode;
};

export default function DelayedFallback({
  ms = 150,
  children,
}: DelayedFallbackProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShow(true);
    }, ms);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ms]);

  return show ? <>{children}</> : null;
}
