"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type AuthState = "checking" | "authed" | "blocked" | "error";
type DataState = "idle" | "loading" | "ready" | "error";

const DEFAULT_EXPIRY_WARNING_DAYS = 100;

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F9F8F6",
  padding: "16px",
};

const containerStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const titleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const helperTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#5A514B",
  margin: 0,
};

const backLinkStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
};

const cardStyle: CSSProperties = {
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle: CSSProperties = {
  fontSize: "13px",
  color: "#2E2A27",
  margin: 0,
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  fontSize: "15px",
  background: "#FFFFFF",
};

const buttonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "none",
  background: "#2E2A27",
  color: "#FFFFFF",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};

const logoutButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "999px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

const skeletonBlockStyle: CSSProperties = {
  background: "#E7E3DD",
  borderRadius: "10px",
};

function SkeletonSettings() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ ...skeletonBlockStyle, height: "24px", width: "40%" }} />
      <div style={{ ...cardStyle, border: "none" }}>
        <div style={{ ...skeletonBlockStyle, height: "14px", width: "30%" }} />
        <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
        <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const backHref = queryString ? `/products?${queryString}` : "/products";
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [dataState, setDataState] = useState<DataState>("idle");
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [expiryDays, setExpiryDays] = useState(DEFAULT_EXPIRY_WARNING_DAYS);
  const [inputValue, setInputValue] = useState(
    String(DEFAULT_EXPIRY_WARNING_DAYS)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAuth = async () => {
      setAuthState("checking");
      setErrorMessage(null);
      setProfileRole(null);

      const { user, error: sessionError } = await getSessionUser();
      if (cancelled) {
        return;
      }

      if (sessionError) {
        console.error("Failed to read session", sessionError);
        setErrorMessage("인증 정보를 불러오지 못했어요.");
        setAuthState("error");
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { profile, error: profileError } = await getUserProfile(user.id);
      if (cancelled) {
        return;
      }

      if (profileError) {
        console.error("Failed to fetch users_profile", profileError);
        setErrorMessage("프로필 정보를 불러오지 못했어요.");
        setAuthState("error");
        return;
      }

      if (!profile) {
        const { error: signOutError } = await signOut();
        if (signOutError) {
          console.error("Failed to sign out", signOutError);
        }
        router.replace("/login?notice=profile-missing");
        return;
      }

      if (profile.active === false) {
        setAuthState("blocked");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("users_profile")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) {
        console.error("Failed to fetch user role", roleError);
      } else {
        setProfileRole(roleData?.role ?? null);
      }

      setAuthState("authed");
    };

    loadAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authState !== "authed") {
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      setDataState("loading");
      setSettingsError(null);

      const { data, error } = await supabase.rpc("get_expiry_warning_days");
      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Failed to fetch expiry warning days", error);
        setSettingsError("설정을 불러오지 못했어요.");
        setExpiryDays(DEFAULT_EXPIRY_WARNING_DAYS);
        setInputValue(String(DEFAULT_EXPIRY_WARNING_DAYS));
        setDataState("ready");
        return;
      }

      const nextValue =
        typeof data === "number" ? data : DEFAULT_EXPIRY_WARNING_DAYS;
      setExpiryDays(nextValue);
      setInputValue(String(nextValue));
      setDataState("ready");
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  const isLoading =
    authState === "checking" ||
    (authState === "authed" && (dataState === "idle" || dataState === "loading"));

  const hasError =
    authState === "error" || (authState === "authed" && dataState === "error");

  const isAdmin = profileRole === "admin";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin || isSaving) {
      return;
    }

      setSaveError(null);
      setSaveSuccess(null);

    const trimmed = inputValue.trim();
    if (!/^\d+$/.test(trimmed)) {
      setSaveError("1~365 사이 정수를 입력해 주세요.");
      return;
    }

    const nextValue = Number(trimmed);
    if (!Number.isInteger(nextValue) || nextValue < 1 || nextValue > 365) {
      setSaveError("1~365 사이 정수를 입력해 주세요.");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.rpc("set_expiry_warning_days", {
      p_days: nextValue,
    });

    if (error) {
      console.error("Failed to save expiry warning days", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("not authenticated")) {
        setSaveError("세션이 만료되었어요. 다시 로그인해 주세요.");
      } else if (message.includes("admin only")) {
        setSaveError("관리자만 변경할 수 있어요.");
      } else if (message.includes("invalid days")) {
        setSaveError("1~365 사이 정수를 입력해 주세요.");
      } else {
        setSaveError("저장에 실패했어요.");
      }
      setIsSaving(false);
      return;
    }

    setExpiryDays(nextValue);
    setInputValue(String(nextValue));
    setSaveSuccess("저장했어요.");
    setIsSaving(false);
  };

  const handleLogout = async () => {
    setSignOutError(null);
    const { error } = await signOut();
    if (error) {
      console.error("Failed to sign out", error);
      setSignOutError("로그아웃에 실패했어요.");
      return;
    }
    router.replace("/login");
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {authState === "blocked" ? (
          <div style={{ ...cardStyle, gap: "12px" }}>
            <p style={helperTextStyle}>
              계정이 비활성화되어 있어 접근할 수 없어요.
            </p>
            <button type="button" style={buttonStyle} onClick={handleLogout}>
              로그아웃
            </button>
            {signOutError ? (
              <p style={helperTextStyle}>{signOutError}</p>
            ) : null}
          </div>
        ) : isLoading ? (
          <SkeletonSettings />
        ) : hasError ? (
          <div style={cardStyle}>
            <p style={helperTextStyle}>
              {errorMessage ?? "설정을 불러오지 못했어요."}
            </p>
          </div>
        ) : (
          <>
            <header style={headerStyle}>
              <div style={headerRowStyle}>
                <Link href={backHref} style={backLinkStyle}>
                  목록으로
                </Link>
                <button
                  type="button"
                  style={logoutButtonStyle}
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
              <h1 style={titleStyle}>설정</h1>
            </header>
            {signOutError ? (
              <p style={helperTextStyle}>{signOutError}</p>
            ) : null}
            <div style={cardStyle}>
              <form
                onSubmit={handleSubmit}
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                <div style={fieldStyle}>
                  <label htmlFor="expiry-warning" style={labelStyle}>
                    임박 기준(일)
                  </label>
                  <input
                    id="expiry-warning"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={inputValue}
                    onChange={(event) => setInputValue(event.currentTarget.value)}
                    placeholder={`${expiryDays}`}
                    style={inputStyle}
                    disabled={!isAdmin || isSaving}
                  />
                  <p style={helperTextStyle}>1~365 사이 정수를 입력해 주세요.</p>
                  <p style={helperTextStyle}>
                    임박 배지는 유통기한이 기준일 이하일 때만 표시돼요.
                  </p>
                </div>
                {settingsError ? (
                  <p style={helperTextStyle}>{settingsError}</p>
                ) : null}
                {saveError ? <p style={helperTextStyle}>{saveError}</p> : null}
                {saveSuccess ? (
                  <>
                    <p style={helperTextStyle}>{saveSuccess}</p>
                    <button
                      type="button"
                      style={secondaryButtonStyle}
                      onClick={() => router.replace(backHref)}
                    >
                      목록으로 돌아가기
                    </button>
                  </>
                ) : null}
                {isAdmin ? (
                  <button type="submit" style={buttonStyle} disabled={isSaving}>
                    {isSaving ? "처리 중..." : "저장"}
                  </button>
                ) : (
                  <p style={helperTextStyle}>관리자만 변경할 수 있어요.</p>
                )}
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
