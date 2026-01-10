"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";

const pageClassName =
  "relative isolate min-h-[100svh] overflow-hidden bg-[#F9F8F6] px-4 pb-10 pt-8 sm:pt-12 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.7)_0%,rgba(249,248,246,0)_70%),radial-gradient(140%_140%_at_50%_50%,rgba(15,23,42,0)_60%,rgba(15,23,42,0.06)_100%)] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:opacity-[0.35] after:[background-image:radial-gradient(rgba(15,23,42,0.08)_1px,transparent_1px)] after:[background-size:3px_3px] after:content-['']";
const containerClassName =
  "relative z-10 mx-auto flex w-full max-w-[420px] flex-col items-center gap-6";
const cardClassName =
  "w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-7";
const labelClassName = "text-xs font-semibold tracking-[0.12em] text-slate-500";
const inputClassName =
  "mt-2 h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-safe:transition-colors";
const buttonClassName =
  "h-12 w-full rounded-md bg-gradient-to-b from-slate-900 to-slate-950 text-sm font-semibold text-white shadow-sm shadow-slate-900/20 hover:from-slate-800 hover:to-slate-900 active:from-slate-950 active:to-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-500 disabled:opacity-70 motion-safe:transition-colors";

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
  const header = (
    <div className="text-center">
      <p className="text-ink-3d text-lg font-semibold leading-tight tracking-[0.18em] text-slate-700">
        온누리 종합식품
      </p>
      <p className="text-ink-3d mt-1 text-lg font-bold leading-tight tracking-[0.06em] text-slate-900">
        재고 조사 시스템
      </p>
      <div className="mx-auto mt-2 h-px w-16 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
    </div>
  );

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
      <div className={pageClassName}>
        <div
          className={`${containerClassName} animate-pulse motion-reduce:animate-none`}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="h-3 w-32 rounded-full bg-slate-200" />
            <div className="h-5 w-40 rounded-full bg-slate-200" />
          </div>
          <div className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
            <div className="h-6 w-28 rounded bg-slate-200" />
            <div className="h-4 w-48 rounded bg-slate-200" />
            <div className="h-12 w-full rounded bg-slate-200" />
            <div className="h-12 w-full rounded bg-slate-200" />
            <div className="h-12 w-full rounded bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className={pageClassName}>
        <div className={containerClassName}>
          {header}
          <div className={`${cardClassName} text-center`}>
            <h1 className="text-lg font-semibold text-slate-900">접근 안내</h1>
            <p className="mt-2 text-sm text-slate-600">
              {effectiveAccessMessage}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className={`mt-6 ${buttonClassName}`}
            >
              {signingOut ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageClassName}>
      <div className={containerClassName}>
        {header}
        <div className={cardClassName}>
          <div className="text-left">
            <h1 className="text-2xl font-semibold text-slate-900">로그인</h1>
            <p className="mt-2 text-sm text-slate-600">
              이메일과 비밀번호를 입력하세요.
            </p>
          </div>

          {effectiveAccessMessage && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {effectiveAccessMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
            <div>
              <label className={labelClassName}>이메일</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label className={labelClassName}>비밀번호</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                className={inputClassName}
                required
              />
            </div>

            {formError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={buttonClassName}
            >
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
