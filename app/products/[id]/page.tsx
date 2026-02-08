import { Suspense } from "react";
import DelayedFallback from "@/app/_components/DelayedFallback";
import RouteFallback from "@/app/_components/RouteFallback";
import ProductDetailClient from "./ProductDetailClient";

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <DelayedFallback ms={150}>
          <RouteFallback />
        </DelayedFallback>
      }
    >
      <ProductDetailClient />
    </Suspense>
  );
}
