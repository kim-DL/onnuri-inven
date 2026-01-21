import { Suspense } from "react";
import { Noto_Sans_KR } from "next/font/google";
import DashboardClient from "./DashboardClient";

const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export default function DashboardPage() {
  return (
    <div className={notoSansKr.className}>
      <Suspense fallback={null}>
        <DashboardClient />
      </Suspense>
    </div>
  );
}
