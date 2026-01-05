"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type AuthState = "checking" | "authed" | "blocked" | "error";
type DataState = "idle" | "loading" | "ready" | "error";
type AdminUserProfileRpcRow = {
  user_id: string;
  display_name: string | null;
  role: string | null;
  is_active?: boolean | null;
  active?: boolean | null;
  created_at?: string | null;
};
type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
};
type UserActionState = {
  userId: string;
  type: "toggle" | "rename";
};

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

const cardTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
};

const userListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const userRowStyle: CSSProperties = {
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #E8E2DB",
  background: "#FBFAF8",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const userHeaderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const userNameStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  margin: 0,
};

const userMetaStyle: CSSProperties = {
  fontSize: "13px",
  color: "#5A514B",
  margin: 0,
};

const userMetaSmallStyle: CSSProperties = {
  fontSize: "12px",
  color: "#7B736C",
  margin: 0,
};

const userActionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const statusBadgeStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  whiteSpace: "nowrap",
};

const statusBadgeActiveStyle: CSSProperties = {
  ...statusBadgeStyle,
  background: "#ECFDF3",
  borderColor: "#ABEFC6",
  color: "#067647",
};

const statusBadgeInactiveStyle: CSSProperties = {
  ...statusBadgeStyle,
  background: "#FEE4E2",
  borderColor: "#FECDCA",
  color: "#B42318",
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

const compactInputStyle: CSSProperties = {
  ...inputStyle,
  fontSize: "14px",
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

function SkeletonUserList() {
  return (
    <div style={userListStyle}>
      {[0, 1, 2].map((item) => (
        <div key={item} style={{ ...userRowStyle, border: "none" }}>
          <div style={{ ...skeletonBlockStyle, height: "16px", width: "40%" }} />
          <div style={{ ...skeletonBlockStyle, height: "12px", width: "55%" }} />
          <div style={{ ...skeletonBlockStyle, height: "12px", width: "30%" }} />
        </div>
      ))}
    </div>
  );
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userListState, setUserListState] = useState<DataState>("idle");
  const [userProfiles, setUserProfiles] = useState<UserProfileRow[]>([]);
  const [userListError, setUserListError] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);
  const [userActionState, setUserActionState] =
    useState<UserActionState | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadAuth = async () => {
      setAuthState("checking");
      setErrorMessage(null);
      setProfileRole(null);
      setCurrentUserId(null);

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

      setCurrentUserId(user.id);

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

  useEffect(() => {
    if (authState !== "authed" || profileRole !== "admin") {
      return;
    }

    let cancelled = false;

    const loadUserProfiles = async () => {
      setUserListState("loading");
      setUserListError(null);
      setUserActionError(null);
      setUserActionSuccess(null);

      const { data, error } = await supabase.rpc("admin_list_user_profiles");
      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Failed to fetch user profiles", error);
        setUserListError("Unable to load users.");
        setUserListState("error");
        return;
      }

      const rawRows = (data as AdminUserProfileRpcRow[] | null) ?? [];
      const normalized = rawRows.map((row) => ({
        user_id: row.user_id,
        display_name: row.display_name ?? null,
        role: row.role ?? null,
        is_active: row.is_active ?? row.active ?? null,
        created_at: row.created_at ?? null,
      }));

      setUserProfiles(normalized);
      setUserListState("ready");
    };

    loadUserProfiles();

    return () => {
      cancelled = true;
    };
  }, [authState, profileRole]);

  const isLoading =
    authState === "checking" ||
    (authState === "authed" && (dataState === "idle" || dataState === "loading"));

  const hasError =
    authState === "error" || (authState === "authed" && dataState === "error");

  const isAdmin = profileRole === "admin";
  const isUserMutating = userActionState !== null;
  const isUserListLoading =
    userListState === "idle" || userListState === "loading";

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

  const handleToggleUserActive = async (profile: UserProfileRow) => {
    if (!isAdmin || isUserMutating) {
      return;
    }

    const isActive = profile.is_active ?? false;
    const nextActive = !isActive;

    setUserActionError(null);
    setUserActionSuccess(null);
    setUserActionState({ userId: profile.user_id, type: "toggle" });

    const { error } = await supabase.rpc("admin_set_user_active", {
      p_user_id: profile.user_id,
      p_is_active: nextActive,
    });

    if (error) {
      console.error("Failed to update user active status", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("not authenticated")) {
        setUserActionError("Session expired. Please sign in again.");
      } else if (message.includes("admin only")) {
        setUserActionError("Admin only.");
      } else if (message.includes("self")) {
        setUserActionError("You cannot deactivate your own account.");
      } else {
        setUserActionError("Unable to update active status.");
      }
      setUserActionState(null);
      return;
    }

    setUserProfiles((prev) =>
      prev.map((row) =>
        row.user_id === profile.user_id
          ? { ...row, is_active: nextActive }
          : row
      )
    );
    setUserActionSuccess(nextActive ? "User activated." : "User deactivated.");
    setUserActionState(null);
  };

  const startEditDisplayName = (profile: UserProfileRow) => {
    if (!isAdmin || isUserMutating) {
      return;
    }
    setEditingUserId(profile.user_id);
    setNameDrafts((prev) => ({
      ...prev,
      [profile.user_id]: profile.display_name ?? "",
    }));
    setUserActionError(null);
    setUserActionSuccess(null);
  };

  const cancelEditDisplayName = () => {
    if (isUserMutating) {
      return;
    }
    setEditingUserId(null);
  };

  const handleDisplayNameChange = (userId: string, value: string) => {
    setNameDrafts((prev) => ({ ...prev, [userId]: value }));
  };

  const handleSaveDisplayName = async (profile: UserProfileRow) => {
    if (!isAdmin || isUserMutating) {
      return;
    }

    const draft = nameDrafts[profile.user_id] ?? "";
    const trimmed = draft.trim();
    if (!trimmed) {
      setUserActionError("Display name is required.");
      return;
    }

    const current = profile.display_name?.trim() ?? "";
    if (trimmed === current) {
      setEditingUserId(null);
      return;
    }

    setUserActionError(null);
    setUserActionSuccess(null);
    setUserActionState({ userId: profile.user_id, type: "rename" });

    const { error } = await supabase.rpc("admin_set_user_display_name", {
      p_user_id: profile.user_id,
      p_display_name: trimmed,
    });

    if (error) {
      console.error("Failed to update user display name", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("not authenticated")) {
        setUserActionError("Session expired. Please sign in again.");
      } else if (message.includes("admin only")) {
        setUserActionError("Admin only.");
      } else if (message.includes("invalid")) {
        setUserActionError("Display name is invalid.");
      } else {
        setUserActionError("Unable to update display name.");
      }
      setUserActionState(null);
      return;
    }

    setUserProfiles((prev) =>
      prev.map((row) =>
        row.user_id === profile.user_id
          ? { ...row, display_name: trimmed }
          : row
      )
    );
    setNameDrafts((prev) => ({ ...prev, [profile.user_id]: trimmed }));
    setEditingUserId(null);
    setUserActionSuccess("Display name updated.");
    setUserActionState(null);
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
            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>User Management</h2>
              {!isAdmin ? (
                <p style={helperTextStyle}>Admin only.</p>
              ) : (
                <>
                  {userActionError ? (
                    <p style={helperTextStyle}>{userActionError}</p>
                  ) : null}
                  {userActionSuccess ? (
                    <p style={helperTextStyle}>{userActionSuccess}</p>
                  ) : null}
                  {isUserListLoading ? (
                    <SkeletonUserList />
                  ) : userListState === "error" ? (
                    <p style={helperTextStyle}>
                      {userListError ?? "Unable to load users."}
                    </p>
                  ) : userProfiles.length === 0 ? (
                    <p style={helperTextStyle}>No users found.</p>
                  ) : (
                    <div style={userListStyle}>
                      {userProfiles.map((profile) => {
                        const displayName =
                          profile.display_name?.trim() || "Unnamed";
                        const roleLabel = profile.role ?? "unknown";
                        const isActive = profile.is_active ?? false;
                        const createdLabel = formatDateLabel(
                          profile.created_at
                        );
                        const isEditing = editingUserId === profile.user_id;
                        const isSelf =
                          currentUserId && profile.user_id === currentUserId;
                        const isToggling =
                          userActionState?.userId === profile.user_id &&
                          userActionState?.type === "toggle";
                        const isRenaming =
                          userActionState?.userId === profile.user_id &&
                          userActionState?.type === "rename";
                        const nameInputId = `display-name-${profile.user_id}`;

                        return (
                          <div key={profile.user_id} style={userRowStyle}>
                            <div style={userHeaderRowStyle}>
                              <p style={userNameStyle}>
                                {displayName}
                                {isSelf ? " (you)" : ""}
                              </p>
                              <span
                                style={
                                  isActive
                                    ? statusBadgeActiveStyle
                                    : statusBadgeInactiveStyle
                                }
                              >
                                {isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <p style={userMetaStyle}>Role: {roleLabel}</p>
                            {createdLabel ? (
                              <p style={userMetaSmallStyle}>
                                Created: {createdLabel}
                              </p>
                            ) : null}
                            {isEditing ? (
                              <div style={fieldStyle}>
                                <label htmlFor={nameInputId} style={labelStyle}>
                                  Display name
                                </label>
                                <input
                                  id={nameInputId}
                                  type="text"
                                  value={
                                    nameDrafts[profile.user_id] ??
                                    profile.display_name ??
                                    ""
                                  }
                                  onChange={(event) =>
                                    handleDisplayNameChange(
                                      profile.user_id,
                                      event.currentTarget.value
                                    )
                                  }
                                  style={compactInputStyle}
                                  disabled={isUserMutating}
                                />
                              </div>
                            ) : null}
                            <div style={userActionRowStyle}>
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    style={buttonStyle}
                                    onClick={() =>
                                      handleSaveDisplayName(profile)
                                    }
                                    disabled={isUserMutating}
                                  >
                                    {isRenaming ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    style={secondaryButtonStyle}
                                    onClick={cancelEditDisplayName}
                                    disabled={isUserMutating}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    style={secondaryButtonStyle}
                                    onClick={() =>
                                      startEditDisplayName(profile)
                                    }
                                    disabled={isUserMutating}
                                  >
                                    Rename
                                  </button>
                                  <button
                                    type="button"
                                    style={secondaryButtonStyle}
                                    onClick={() => handleToggleUserActive(profile)}
                                    disabled={isUserMutating}
                                  >
                                    {isToggling
                                      ? "Updating..."
                                      : isActive
                                      ? "Deactivate"
                                      : "Activate"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
