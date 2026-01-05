import { Suspense } from "react";
import ArchivedProductsClient from "./ArchivedProductsClient";

export default function ArchivedProductsPage() {
  return (
    <Suspense fallback={null}>
      <ArchivedProductsClient />
    </Suspense>
  );
}
