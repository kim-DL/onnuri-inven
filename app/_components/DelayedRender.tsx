"use client";

import type { ReactNode } from "react";
import DelayedFallback from "./DelayedFallback";

type DelayedRenderProps = {
  active: boolean;
  ms?: number;
  children: ReactNode;
};

export default function DelayedRender({
  active,
  ms = 150,
  children,
}: DelayedRenderProps) {
  if (!active) {
    return null;
  }

  return <DelayedFallback ms={ms}>{children}</DelayedFallback>;
}
