"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const noticeMessage =
    notice === "profile-missing"
      ? "프로필이 설정되지 않았습니다. 관리자에게 문의하세요."
      : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const effectiveAccessMessage = accessMessage ?? noticeMessage;

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      const { user, error: sessionError } = await getSessionUser();
      if (!isActive) {
        return;
      }

      if (sessionError) {
        console.error("세션 확인 실패", sessionError);
        setAccessMessage("로그인 상태를 확인할 수 없습니다.");
        setChecking(false);
        return;
      }

      if (!user) {
        setChecking(false);
        return;
      }

      const { profile, error: profileError } = await getUserProfile(user.id);
      if (!isActive) {
        return;
      }

      if (profileError) {
        console.error("프로필 조회 실패", profileError);
        setAccessMessage("프로필 정보를 가져오지 못했습니다.");
        setChecking(false);
        return;
      }

      if (!profile) {
        console.error("프로필 없음", { userId: user.id });
        const { error: signOutError } = await signOut();
        if (signOutError) {
          console.error("로그아웃 실패", signOutError);
        }
        setAccessMessage("프로필이 설정되지 않았습니다. 관리자에게 문의하세요.");
        setChecking(false);
        return;
      }

      if (profile.active === false) {
        setAccessMessage("접근이 제한되었습니다(비활성 계정)");
        setIsBlocked(true);
        setChecking(false);
        return;
      }

      router.replace("/products");
    };

    run();

    return () => {
      isActive = false;
    };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("로그인 실패", error);
      setFormError("로그인에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    const user = data.user;
    if (!user) {
      console.error("로그인 실패: 사용자 정보 없음");
      setFormError("로그인에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    const { profile, error: profileError } = await getUserProfile(user.id);
    if (profileError) {
      console.error("프로필 조회 실패", profileError);
      setFormError("프로필 정보를 가져오지 못했습니다.");
      setSubmitting(false);
      return;
    }

    if (!profile) {
      console.error("프로필 없음", { userId: user.id });
      const { error: signOutError } = await signOut();
      if (signOutError) {
        console.error("로그아웃 실패", signOutError);
      }
      setAccessMessage("프로필이 설정되지 않았습니다. 관리자에게 문의하세요.");
      setSubmitting(false);
      return;
    }

    if (profile.active === false) {
      setAccessMessage("접근이 제한되었습니다(비활성 계정)");
      setIsBlocked(true);
      setSubmitting(false);
      return;
    }

    router.replace("/products");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const { error } = await signOut();
    if (error) {
      console.error("로그아웃 실패", error);
    }
    setSigningOut(false);
    setIsBlocked(false);
    setAccessMessage(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-4 py-10">
        <div className="mx-auto w-full max-w-sm animate-pulse space-y-4">
          <div className="h-7 w-28 rounded bg-slate-200" />
          <div className="h-4 w-48 rounded bg-slate-200" />
          <div className="h-12 w-full rounded bg-slate-200" />
          <div className="h-12 w-full rounded bg-slate-200" />
          <div className="h-12 w-full rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-4 py-10">
        <div className="mx-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-slate-900">접근 안내</h1>
          <p className="mt-2 text-sm text-slate-600">
            {effectiveAccessMessage}
          </p>
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

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold text-slate-900">로그인</h1>
          <p className="mt-2 text-sm text-slate-600">
            이메일과 비밀번호를 입력하세요.
          </p>

          {effectiveAccessMessage && (
            <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
              {effectiveAccessMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                이메일
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                비밀번호
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
                required
              />
            </div>

            {formError && (
              <div className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-md bg-slate-900 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
