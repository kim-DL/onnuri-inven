import { Suspense } from "react";
import DelayedRender from "@/app/_components/DelayedRender";
import RouteFallback from "@/app/_components/RouteFallback";
import ProductDetailClient from "./ProductDetailClient";

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <DelayedRender active ms={150}>
          <RouteFallback />
        </DelayedRender>
      }
    >
      <ProductDetailClient />
    </Suspense>
  );
}
