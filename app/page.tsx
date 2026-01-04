"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";

type ViewState = "checking" | "blocked" | "error";

export default function Home() {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      const { user, error: sessionError } = await getSessionUser();
      if (!isActive) {
        return;
      }

      if (sessionError) {
        console.error("세션 확인 실패", sessionError);
        setMessage("로그인 상태를 확인할 수 없습니다.");
        setViewState("error");
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { profile, error: profileError } = await getUserProfile(user.id);
      if (!isActive) {
        return;
      }

      if (profileError) {
        console.error("프로필 조회 실패", profileError);
        setMessage("프로필 정보를 가져오지 못했습니다.");
        setViewState("error");
        return;
      }

      if (!profile) {
        console.error("프로필 없음", { userId: user.id });
        const { error: signOutError } = await signOut();
        if (signOutError) {
          console.error("로그아웃 실패", signOutError);
        }
        router.replace("/login?notice=profile-missing");
        return;
      }

      if (profile.active === false) {
        setMessage("접근이 제한되었습니다(비활성 계정)");
        setViewState("blocked");
        return;
      }

      router.replace("/products");
    };

    run();

    return () => {
      isActive = false;
    };
  }, [router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    const { error } = await signOut();
    if (error) {
      console.error("로그아웃 실패", error);
    }
    setSigningOut(false);
    router.replace("/login");
  };

  if (viewState === "checking") {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-4 py-10">
        <div className="mx-auto w-full max-w-sm animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-slate-200" />
          <div className="h-12 w-full rounded bg-slate-200" />
          <div className="h-12 w-full rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  if (viewState === "blocked" || viewState === "error") {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-4 py-10">
        <div className="mx-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-slate-900">접근 안내</h1>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-6 h-12 w-full rounded-md bg-slate-900 text-sm font-semibold text-white disabled:opacity-60"
          >
            {signingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
