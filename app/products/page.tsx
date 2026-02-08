import { Suspense } from "react";
import DelayedRender from "@/app/_components/DelayedRender";
import RouteFallback from "@/app/_components/RouteFallback";
import ProductsClient from "./ProductsClient";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <DelayedRender active ms={150}>
          <RouteFallback />
        </DelayedRender>
      }
    >
      <ProductsClient />
    </Suspense>
  );
}
