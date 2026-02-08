import { Suspense } from "react";
import DelayedFallback from "@/app/_components/DelayedFallback";
import RouteFallback from "@/app/_components/RouteFallback";
import SettingsClient from "./SettingsClient";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <DelayedFallback ms={150}>
          <RouteFallback />
        </DelayedFallback>
      }
    >
      <SettingsClient />
    </Suspense>
  );
}
