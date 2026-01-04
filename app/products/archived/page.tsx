"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type ArchivedProduct = {
  id: string;
  name: string;
  manufacturer: string | null;
  zone_name?: string | null;
  zone?: string | null;
  stock?: number | null;
  archived_at?: string | null;
  archived_reason?: string | null;
};

type AuthState = "checking" | "authed" | "blocked" | "error";
type DataState = "idle" | "loading" | "ready" | "error";

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

const titleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const cardStyle: CSSProperties = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const cardTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
};

const cardRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const cardRowLeftStyle: CSSProperties = {
  fontSize: "13px",
  color: "#5A514B",
  margin: 0,
  flex: 1,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const cardRowRightStyle: CSSProperties = {
  fontSize: "13px",
  color: "#5A514B",
  margin: 0,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const cardMetaStyle: CSSProperties = {
  fontSize: "12px",
  color: "#7B736C",
  margin: 0,
};

const helperTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#5A514B",
  margin: 0,
};

const skeletonBlockStyle: CSSProperties = {
  background: "#E7E3DD",
  borderRadius: "10px",
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

const restoreButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  alignSelf: "flex-start",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(46, 42, 39, 0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 50,
};

const modalCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "360px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const modalTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
  color: "#2E2A27",
};

const modalButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
};

const modalCancelStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
  flex: 1,
};

const modalConfirmStyle: CSSProperties = {
  ...buttonStyle,
  flex: 1,
};

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {[0, 1, 2].map((item) => (
        <div key={item} style={{ ...cardStyle, border: "none" }}>
          <div style={{ ...skeletonBlockStyle, height: "18px", width: "60%" }} />
          <div style={{ ...skeletonBlockStyle, height: "14px", width: "40%" }} />
          <div style={{ ...skeletonBlockStyle, height: "12px", width: "30%" }} />
        </div>
      ))}
    </div>
  );
}

function formatTimestamp(raw: string) {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString("ko-KR");
}

export default function ArchivedProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const backHref = queryString ? `/products?${queryString}` : "/products";

  const [authState, setAuthState] = useState<AuthState>("checking");
  const [dataState, setDataState] = useState<DataState>("idle");
  const [archivedProducts, setArchivedProducts] = useState<ArchivedProduct[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ArchivedProduct | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAuth = async () => {
      setAuthState("checking");
      setErrorMessage(null);

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

    const loadArchived = async () => {
      setDataState("loading");
      setErrorMessage(null);

      const { data, error } = await supabase.rpc("list_archived_products", {
        p_limit: 200,
      });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Failed to fetch archived products", error);
        setErrorMessage("목록을 불러오지 못했어요.");
        setDataState("error");
        return;
      }

      setArchivedProducts((data as ArchivedProduct[] | null) ?? []);
      setDataState("ready");
    };

    loadArchived();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  const isLoading =
    authState === "checking" ||
    (authState === "authed" && (dataState === "idle" || dataState === "loading"));

  const hasError =
    authState === "error" || (authState === "authed" && dataState === "error");

  const openRestoreModal = (target: ArchivedProduct) => {
    setRestoreTarget(target);
    setRestoreError(null);
  };

  const closeRestoreModal = () => {
    if (isRestoring) {
      return;
    }
    setRestoreTarget(null);
    setRestoreError(null);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreTarget?.id) {
      setRestoreError("복구에 실패했어요.");
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);

    const { error } = await supabase.rpc("restore_product", {
      p_product_id: restoreTarget.id,
    });

    if (error) {
      console.error("Failed to restore product", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("not authenticated")) {
        setRestoreError("세션이 만료되었어요. 다시 로그인해 주세요.");
      } else if (message.includes("inactive user")) {
        setRestoreError("권한이 없어요.");
      } else {
        setRestoreError("복구에 실패했어요.");
      }
      setIsRestoring(false);
      return;
    }

    setRestoreTarget(null);
    setIsRestoring(false);

    const { data, error: refreshError } = await supabase.rpc(
      "list_archived_products",
      { p_limit: 200 }
    );
    if (refreshError) {
      console.error("Failed to fetch archived products", refreshError);
      setErrorMessage("목록을 불러오지 못했어요.");
      setDataState("error");
      return;
    }
    setArchivedProducts((data as ArchivedProduct[] | null) ?? []);
    setDataState("ready");
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

  const archivedList = useMemo(
    () =>
      archivedProducts.map((product) => {
        const manufacturer = product.manufacturer?.trim() || "제조사 미입력";
        const zoneName = product.zone_name ?? product.zone ?? "구역 미지정";
        const stock = typeof product.stock === "number" ? product.stock : 0;
        const metaLeft = `${manufacturer} · ${zoneName}`;
        const archivedAt = product.archived_at
          ? formatTimestamp(product.archived_at)
          : null;
        const archivedReason = product.archived_reason?.trim() || null;

        return (
          <div key={product.id} style={cardStyle}>
            <p style={cardTitleStyle}>{product.name}</p>
            <div style={cardRowStyle}>
              <p style={cardRowLeftStyle}>{metaLeft}</p>
              <p style={cardRowRightStyle}>재고 {stock}</p>
            </div>
            {archivedAt ? (
              <p style={cardMetaStyle}>비활성화: {archivedAt}</p>
            ) : null}
            {archivedReason ? (
              <p style={cardMetaStyle}>사유: {archivedReason}</p>
            ) : null}
            <button
              type="button"
              style={restoreButtonStyle}
              onClick={() => openRestoreModal(product)}
              disabled={isRestoring}
            >
              복구
            </button>
          </div>
        );
      }),
    [archivedProducts, isRestoring]
  );

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
          <SkeletonList />
        ) : hasError ? (
          <div style={cardStyle}>
            <p style={helperTextStyle}>
              {errorMessage ?? "목록을 불러오지 못했어요."}
            </p>
          </div>
        ) : (
          <>
            <header style={headerStyle}>
              <Link href={backHref} style={backLinkStyle}>
                목록으로
              </Link>
              <h1 style={titleStyle}>비활성화된 상품</h1>
            </header>
            {archivedProducts.length === 0 ? (
              <div style={cardStyle}>
                <p style={helperTextStyle}>비활성화된 상품이 없어요.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {archivedList}
              </div>
            )}
          </>
        )}
        {restoreTarget ? (
          <div style={modalOverlayStyle}>
            <div
              style={modalCardStyle}
              role="dialog"
              aria-modal="true"
              aria-labelledby="restore-title"
            >
              <h2 id="restore-title" style={modalTitleStyle}>
                상품을 복구할까요?
              </h2>
              <p style={helperTextStyle}>
                복구하면 상품이 다시 목록에 표시돼요.
              </p>
              {restoreError ? <p style={helperTextStyle}>{restoreError}</p> : null}
              <div style={modalButtonRowStyle}>
                <button
                  type="button"
                  style={modalCancelStyle}
                  onClick={closeRestoreModal}
                  disabled={isRestoring}
                >
                  취소
                </button>
                <button
                  type="button"
                  style={modalConfirmStyle}
                  onClick={handleRestoreConfirm}
                  disabled={isRestoring}
                >
                  {isRestoring ? "처리 중..." : "복구"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
