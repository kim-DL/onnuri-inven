import { Suspense } from "react";
import DelayedFallback from "@/app/_components/DelayedFallback";
import RouteFallback from "@/app/_components/RouteFallback";
import ProductsClient from "./ProductsClient";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <DelayedFallback ms={150}>
          <RouteFallback />
        </DelayedFallback>
      }
    >
      <ProductsClient />
    </Suspense>
  );
}
