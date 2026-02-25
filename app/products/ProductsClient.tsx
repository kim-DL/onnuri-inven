"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompositionEvent, CSSProperties, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import DelayedRender from "@/app/_components/DelayedRender";
import pageListIcon from "@/asset/page_v1.svg";
import { resolveProductPhotoUrl } from "@/lib/productPhoto";
import { useExpiryWarningDays } from "@/lib/useExpiryWarningDays";
import {
  useProductsListData,
  type InventoryCheckContext,
  type ProductsListProduct,
  type ProductsListZone,
} from "@/lib/useProductsListData";
import {
  ZONE_KEYWORDS,
  parseSearchTokens,
  tokensMatchText,
} from "../../lib/search";

type AuthState = "checking" | "authed" | "blocked" | "error";

const ZONE_PARAM_MAP = new Map(
  ZONE_KEYWORDS.map((keyword) => [keyword.toLowerCase(), keyword])
);

const titleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const headerTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  paddingLeft: "4px",
};

const headerTitleIconStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  flexShrink: 0,
};

const headerBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const headerActionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  paddingRight: "8px",
};

const menuWrapperStyle: CSSProperties = {
  position: "relative",
};

const menuButtonStyle: CSSProperties = {
  minHeight: "44px",
  width: "44px",
  padding: 0,
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const menuOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "transparent",
  zIndex: 8,
};

const menuPanelStyle: CSSProperties = {
  position: "absolute",
  top: "52px",
  right: 0,
  minWidth: "180px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  boxShadow: "0 8px 20px rgba(46, 42, 39, 0.15)",
  display: "flex",
  flexDirection: "column",
  padding: "6px",
  zIndex: 9,
};

const menuItemStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "none",
  background: "transparent",
  color: "#2E2A27",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
};

const menuDividerStyle: CSSProperties = {
  height: "1px",
  background: "#E8E2DB",
  margin: "4px 6px",
};

const pageContainerStyle: CSSProperties = {
  minHeight: "100vh",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const pageInnerStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  padding: "16px 8px 0",
  gap: "10px",
};

const scrollAreaStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflowY: "auto",
  gap: "10px",
  paddingBottom: "96px",
};

const stickyControlsStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 6,
  background: "#F9F8F6",
  paddingTop: "1px",
  paddingBottom: "0",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "nowrap",
  justifyContent: "center",
  gap: "6px",
  width: "100%",
  maxWidth: "100%",
};

const chipBaseStyle: CSSProperties = {
  height: "44px",
  width: "60px",
  minWidth: "60px",
  flexShrink: 0,
  borderRadius: "8px",
  border: "1px solid #D6D2CC",
  background: "transparent",
  color: "#6B625B",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const chipActiveStyle: CSSProperties = {
  background: "#d3e8f2",
  color: "#1f2937",
  border: "1px solid #9fc6da",
};

const chipClassName =
  "select-none transition-[transform,box-shadow,background-color,border-color] duration-150 shadow-[0_1px_0_rgba(255,255,255,0.85),0_2px_6px_rgba(0,0,0,0.08)] active:translate-y-[1px] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15),0_1px_0_rgba(255,255,255,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9fc6da] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F9F8F6]";

const inputStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  fontSize: "15px",
  background: "#FFFFFF",
};

const searchFieldStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  flex: 1,
  minWidth: 0,
};

const searchControlRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const searchInputStyle: CSSProperties = {
  ...inputStyle,
  width: "100%",
  paddingRight: "104px",
};

const searchButtonRowStyle: CSSProperties = {
  position: "absolute",
  right: "6px",
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

const searchIconButtonStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "10px",
  border: "none",
  background: "transparent",
  color: "#2E2A27",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const searchIconStyle: CSSProperties = {
  width: "18px",
  height: "18px",
  display: "block",
};

const cardStyle: CSSProperties = {
  padding: "8px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const cardCheckPendingStyle: CSSProperties = {
  borderWidth: "2px",
  borderColor: "#F59E0B",
};

const cardCheckDoneStyle: CSSProperties = {
  borderWidth: "2px",
  borderColor: "#16A34A",
  background: "#F8FFF8",
};

const cardContentStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "64px minmax(0, 1fr)",
  gap: "6px",
  alignItems: "flex-start",
};

const thumbnailStyle: CSSProperties = {
  width: "64px",
  height: "64px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#F1EDE7",
  position: "relative",
  overflow: "hidden",
  flexShrink: 0,
};

const thumbnailPlaceholderStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  color: "#8C847D",
  fontWeight: 600,
  textAlign: "center",
};

const thumbnailImageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const cardBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
};

const cardRowPrimaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "start",
  gap: "6px",
};

const cardRowSecondaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "8px",
};

const cardTitleStyle: CSSProperties = {
  fontSize: "17px",
  fontWeight: 700,
  margin: 0,
  lineHeight: 1.2,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardMetaStyle: CSSProperties = {
  fontSize: "14px",
  color: "#5A514B",
  margin: 0,
  lineHeight: 1.25,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const stockBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "2px",
  minWidth: "56px",
  textAlign: "right",
};

const rightColumnStyle: CSSProperties = {
  minWidth: "56px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const stockLabelStyle: CSSProperties = {
  fontSize: "11px",
  color: "#7B736C",
  margin: 0,
  whiteSpace: "nowrap",
};

const stockValueStyle: CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#005aff",
  margin: 0,
  whiteSpace: "nowrap",
  lineHeight: 1.1,
};

const badgeBaseStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
};

const badgeExpiredStyle: CSSProperties = {
  ...badgeBaseStyle,
  color: "#B42318",
  background: "#FEE4E2",
  borderColor: "#FECDCA",
};

const badgeWarningStyle: CSSProperties = {
  ...badgeBaseStyle,
  color: "#B54708",
  background: "#FEF0C7",
  borderColor: "#FEDF89",
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EMPTY_ZONES: ProductsListZone[] = [];
const EMPTY_PRODUCTS: ProductsListProduct[] = [];
const EMPTY_STOCK_BY_PRODUCT_ID = new Map<string, number>();
const EMPTY_CHECKED_PRODUCT_IDS = new Set<string>();
const EMPTY_CHECK_CONTEXT: InventoryCheckContext = {
  modeEnabled: false,
  modeSource: null,
  activeRunId: null,
  activeRunStartedAt: null,
  overrideMode: "AUTO",
  autoDays: [],
};

type ExpiryBadge = { text: string; style: CSSProperties };
type ListSearchUpdates = {
  zone?: string | null;
  q?: string;
  imminent?: boolean;
  remaining?: boolean;
};

function getDaysLeft(dateValue: string) {
  const parts = dateValue.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const [yearRaw, monthRaw, dayRaw] = parts;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const targetDate = new Date(year, month - 1, day);
  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }
  if (
    targetDate.getFullYear() !== year ||
    targetDate.getMonth() !== month - 1 ||
    targetDate.getDate() !== day
  ) {
    return null;
  }

  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((targetDate.getTime() - todayLocal.getTime()) / MS_PER_DAY);
}

function normalizeZoneParam(zoneParam: string | null): string | null {
  if (!zoneParam) {
    return null;
  }
  const match = ZONE_PARAM_MAP.get(zoneParam.toLowerCase());
  return match ?? null;
}

function getExpiryBadge(
  expiryDateValue: string | null | undefined,
  expiryWarningDays: number
): ExpiryBadge | null {
  const expiryDate = expiryDateValue?.trim() ?? "";
  if (!expiryDate) {
    return null;
  }
  const daysLeft = getDaysLeft(expiryDate);
  if (daysLeft === null) {
    return null;
  }
  if (daysLeft < 0) {
    return { text: "만료", style: badgeExpiredStyle };
  }
  if (daysLeft <= expiryWarningDays) {
    return { text: `임박 D-${daysLeft}`, style: badgeWarningStyle };
  }
  return null;
}

function hasImminentBadge(
  expiryDateValue: string | null | undefined,
  expiryWarningDays: number
) {
  const expiryDate = expiryDateValue?.trim() ?? "";
  if (!expiryDate) {
    return false;
  }
  const daysLeft = getDaysLeft(expiryDate);
  return daysLeft !== null && daysLeft <= expiryWarningDays;
}

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
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

export default function ProductsPage() {
  const DETAIL_PREFETCH_LIMIT = 12;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedZone = normalizeZoneParam(searchParams.get("zone"));
  const isImminentOnly = searchParams.get("imminent") === "1";
  const isRemainingOnly = searchParams.get("remaining") === "1";
  const query = searchParams.get("q") ?? "";
  const [authState, setAuthState] = useState<AuthState>("checking");
  const productsList = useProductsListData({
    enabled: authState === "authed",
  });
  const refetchProductsList = productsList.refetch;
  const dataState = authState === "authed" ? productsList.status : "idle";
  const zones = authState === "authed" ? productsList.zones : EMPTY_ZONES;
  const products =
    authState === "authed" ? productsList.products : EMPTY_PRODUCTS;
  const stockByProductId =
    authState === "authed"
      ? productsList.stockByProductId
      : EMPTY_STOCK_BY_PRODUCT_ID;
  const checkContext =
    authState === "authed" ? productsList.checkContext : EMPTY_CHECK_CONTEXT;
  const checkedProductIds =
    authState === "authed"
      ? productsList.checkedProductIds
      : EMPTY_CHECKED_PRODUCT_IDS;
  const isCheckModeEnabled = checkContext.modeEnabled;
  const expiryWarning = useExpiryWarningDays({
    enabled: authState === "authed",
  });
  const expiryWarningDays = expiryWarning.value;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState(query);
  const [isEditing, setIsEditing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const isComposingRef = useRef(false);
  const prefetchedDetailHrefsRef = useRef(new Set<string>());
  const pendingUpdatesRef = useRef<ListSearchUpdates | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAuth = async () => {
      setAuthState("checking");
      setErrorMessage(null);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (sessionError) {
        console.error("Failed to read session", sessionError);
        setErrorMessage("인증 정보를 불러오지 못했어요.");
        setAuthState("error");
        return;
      }

      const session = sessionData.session;
      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users_profile")
        .select("user_id, active")
        .eq("user_id", session.user.id)
        .maybeSingle();

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
        const { error: signOutError } = await supabase.auth.signOut();
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

    const refetchLatest = () => {
      void refetchProductsList();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetchLatest();
      }
    };

    window.addEventListener("focus", refetchLatest);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refetchLatest);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authState, refetchProductsList]);

  const zoneNameById = useMemo(() => {
    const map = new Map<string, string>();
    zones.forEach((zone) => {
      map.set(zone.id, zone.name);
    });
    return map;
  }, [zones]);

  const committedQuery = query.trim();
  const tokens = useMemo(
    () => parseSearchTokens(committedQuery),
    [committedQuery]
  );
  const resolvedDraftQuery = isEditing ? draftQuery : query;
  const shouldApplyZone = committedQuery.length === 0;
  const activeZone = shouldApplyZone ? selectedZone : null;

  const searchMatchedProducts = useMemo(() => {
    if (products.length === 0) {
      return [];
    }

    return products.filter((product) => {
      const zoneName = product.zone_id
        ? zoneNameById.get(product.zone_id)
        : null;

      if (activeZone && zoneName !== activeZone) {
        return false;
      }

      const haystack = `${product.name} ${product.manufacturer ?? ""}`;
      return tokensMatchText(haystack, tokens);
    });
  }, [activeZone, products, tokens, zoneNameById]);

  const filteredProducts = useMemo(() => {
    if (!isImminentOnly) {
      return searchMatchedProducts;
    }

    return searchMatchedProducts.filter((product) =>
      hasImminentBadge(product.expiry_date, expiryWarningDays)
    );
  }, [expiryWarningDays, isImminentOnly, searchMatchedProducts]);

  const remainingProductsCount = useMemo(() => {
    if (!isCheckModeEnabled) {
      return 0;
    }

    return filteredProducts.filter(
      (product) => !checkedProductIds.has(product.id)
    ).length;
  }, [checkedProductIds, filteredProducts, isCheckModeEnabled]);

  const visibleProducts = useMemo(() => {
    if (!isRemainingOnly || !isCheckModeEnabled) {
      return filteredProducts;
    }

    return filteredProducts.filter((product) => !checkedProductIds.has(product.id));
  }, [checkedProductIds, filteredProducts, isCheckModeEnabled, isRemainingOnly]);

  const isRemainingFilterDisabled = isRemainingOnly && !isCheckModeEnabled;

  const detailQuery = searchParams.toString();
  const detailQuerySuffix = detailQuery ? `?${detailQuery}` : "";

  useEffect(() => {
    if (authState !== "authed" || dataState !== "ready") {
      return;
    }

    const candidateHrefs = visibleProducts
      .slice(0, DETAIL_PREFETCH_LIMIT)
      .map((product) => `/products/${product.id}${detailQuerySuffix}`);

    if (candidateHrefs.length === 0) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const runPrefetch = () => {
      if (cancelled) {
        return;
      }

      candidateHrefs.forEach((href) => {
        if (prefetchedDetailHrefsRef.current.has(href)) {
          return;
        }

        prefetchedDetailHrefsRef.current.add(href);
        router.prefetch(href);
      });
    };

    type IdleWindow = Window & {
      requestIdleCallback?: (
        callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const idleWindow = window as IdleWindow;

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(() => {
        runPrefetch();
      });
    } else {
      timeoutId = window.setTimeout(() => {
        runPrefetch();
      }, 0);
    }

    return () => {
      cancelled = true;

      if (idleId !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [authState, dataState, detailQuerySuffix, router, visibleProducts]);

  const isLoading =
    authState === "checking" ||
    (authState === "authed" && (dataState === "idle" || dataState === "loading"));
  const hasLoadedProducts = products.length > 0;
  const shouldShowListSkeleton = isLoading && !hasLoadedProducts;

  const hasError =
    authState === "error" || (authState === "authed" && dataState === "error");

  const expiryWarningError =
    authState === "authed" && expiryWarning.status === "error"
      ? "유통기한 기준을 불러오지 못했어요."
      : null;
  const archivedHref = detailQuery
    ? `/products/archived?${detailQuery}`
    : "/products/archived";
  const settingsHref = detailQuery ? `/settings?${detailQuery}` : "/settings";
  const remainingMenuLabel = isRemainingOnly
    ? "전체 상품 목록"
    : "재고 점검 잔여 목록";

  const updateSearchParams = useCallback(
    (updates: ListSearchUpdates) => {
      if (isComposingRef.current) {
        pendingUpdatesRef.current = {
          ...pendingUpdatesRef.current,
          ...updates,
        };
        return;
      }

      const nextParams = new URLSearchParams(searchParams.toString());

      if (updates.zone !== undefined) {
        if (updates.zone) {
          nextParams.set("zone", updates.zone);
        } else {
          nextParams.delete("zone");
        }
      }

      if (updates.q !== undefined) {
        if (updates.q) {
          nextParams.set("q", updates.q);
        } else {
          nextParams.delete("q");
        }
      }

      if (updates.imminent !== undefined) {
        if (updates.imminent) {
          nextParams.set("imminent", "1");
        } else {
          nextParams.delete("imminent");
        }
      }

      if (updates.remaining !== undefined) {
        if (updates.remaining) {
          nextParams.set("remaining", "1");
        } else {
          nextParams.delete("remaining");
        }
      }

      const nextUrl = nextParams.toString()
        ? `${pathname}?${nextParams.toString()}`
        : pathname;
      router.replace(nextUrl);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (isComposing || !isEditing) {
      return;
    }

    const nextQuery = draftQuery.trim();
    if (nextQuery === committedQuery) {
      return;
    }

    const timeoutId = setTimeout(() => {
      updateSearchParams({ q: nextQuery });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [committedQuery, draftQuery, isComposing, isEditing, updateSearchParams]);

  const handleCompositionStart = () => {
    isComposingRef.current = true;
    setIsComposing(true);
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    setIsComposing(false);

    const nextValue = event.currentTarget.value;
    setDraftQuery(nextValue);

    const nextQuery = nextValue.trim();
    const pendingUpdates = pendingUpdatesRef.current;
    pendingUpdatesRef.current = null;

    if (!pendingUpdates && nextQuery === committedQuery) {
      return;
    }

    updateSearchParams({ ...(pendingUpdates ?? {}), q: nextQuery });
  };

  const handleSearchFocus = () => {
    setIsEditing(true);
    setDraftQuery(query);
  };

  const handleSearchBlur = () => {
    if (!isComposingRef.current) {
      const nextQuery = draftQuery.trim();
      if (nextQuery !== committedQuery) {
        updateSearchParams({ q: nextQuery });
      }
    }
    setIsEditing(false);
  };

  const handleZoneClick = (zone: string) => {
    const nextZone = selectedZone === zone ? null : zone;
    updateSearchParams({ zone: nextZone });
  };

  const handleLogout = async () => {
    setSignOutError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Failed to sign out", error);
      setSignOutError("로그아웃에 실패했어요.");
      return;
    }
    router.replace("/login");
  };

  const handleToggleRemainingOnly = () => {
    const nextRemainingOnly = !isRemainingOnly;
    setIsMenuOpen(false);
    updateSearchParams({ remaining: nextRemainingOnly });
    if (authState === "authed") {
      void productsList.refetch();
    }
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = resolvedDraftQuery.trim();
    if (nextQuery === committedQuery) {
      return;
    }
    updateSearchParams({ q: nextQuery });
  };

  const handleClearQuery = () => {
    if (!resolvedDraftQuery) {
      return;
    }
    setDraftQuery("");
    updateSearchParams({ q: "" });
  };

  const escapeCsvValue = (value: string) => {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, "\"\"")}"`;
    }
    return value;
  };

  const buildCsvFileName = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const minute = pad(now.getMinutes());
    return `onnuri-products-${year}${month}${day}-${hour}${minute}.csv`;
  };

  const handleExportCsv = () => {
    const headers = ["product_name", "zone", "manufacturer", "stock", "expiry_date"];
    const rows = visibleProducts.map((product) => {
      const zoneName = product.zone_id
        ? zoneNameById.get(product.zone_id)
        : null;
      const manufacturer = product.manufacturer?.trim() || "제조사 미입력";
      const zoneLabel = zoneName ?? "구역 미지정";
      const stock = stockByProductId.get(product.id) ?? 0;
      const expiryDate = product.expiry_date?.trim() ?? "";
      return [
        product.name,
        zoneLabel,
        manufacturer,
        String(stock),
        expiryDate,
      ].map(escapeCsvValue);
    });

    const csvBody = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );
    const csvWithBom = `\uFEFF${csvBody}`;
    const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildCsvFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6]" style={pageContainerStyle}>
      <div className="mx-auto flex max-w-[720px] flex-col" style={pageInnerStyle}>
        <header style={headerBarStyle}>
          <div style={headerTitleRowStyle}>
            <Image
              src={pageListIcon}
              alt=""
              aria-hidden="true"
              style={headerTitleIconStyle}
            />
            <h1 style={titleStyle}>상품 목록</h1>
          </div>
          {authState !== "blocked" ? (
            <div style={headerActionRowStyle}>
              <div style={menuWrapperStyle}>
                <button
                  type="button"
                  className={isMenuOpen ? "productsMenuButton productsMenuButton--open" : "productsMenuButton"}
                  style={menuButtonStyle}
                  aria-label="메뉴 열기"
                  aria-expanded={isMenuOpen}
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                >
                  <span className="productsHamburgerGlyph" aria-hidden="true">
                    <span className="productsHamburgerBar productsHamburgerBar--top" />
                    <span className="productsHamburgerBar productsHamburgerBar--middle" />
                    <span className="productsHamburgerBar productsHamburgerBar--bottom" />
                  </span>
                </button>
                {isMenuOpen ? (
                  <>
                    <div
                      style={menuOverlayStyle}
                      onClick={() => setIsMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <div style={menuPanelStyle}>
                      <Link
                        href="/dashboard"
                        style={menuItemStyle}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        대시보드
                      </Link>
                      <Link
                        href={settingsHref}
                        style={menuItemStyle}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        설정
                      </Link>
                      <Link
                        href={archivedHref}
                        style={menuItemStyle}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        비활성화 목록
                      </Link>
                      <button
                        type="button"
                        style={menuItemStyle}
                        onClick={handleToggleRemainingOnly}
                      >
                        {remainingMenuLabel}
                      </button>
                      <div style={menuDividerStyle} />
                      <button
                        type="button"
                        style={menuItemStyle}
                        onClick={handleExportCsv}
                      >
                        CSV 내보내기
                      </button>
                      <button
                        type="button"
                        style={menuItemStyle}
                        onClick={() => {
                          setIsMenuOpen(false);
                          void handleLogout();
                        }}
                      >
                        로그아웃
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </header>
        {authState !== "blocked" && signOutError ? (
          <p style={helperTextStyle}>{signOutError}</p>
        ) : null}
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
        ) : (
          <>
            <div style={scrollAreaStyle}>
              <div style={stickyControlsStyle}>
                <div style={chipRowStyle}>
                  <button
                    type="button"
                    className={chipClassName}
                    style={{
                      ...chipBaseStyle,
                      ...(!selectedZone ? chipActiveStyle : null),
                    }}
                    onClick={() => updateSearchParams({ zone: null })}
                  >
                    전체
                  </button>
                  {ZONE_KEYWORDS.map((zone) => {
                    const isActive = selectedZone === zone;
                    return (
                      <button
                        key={zone}
                        type="button"
                        className={chipClassName}
                        style={{
                          ...chipBaseStyle,
                          ...(isActive ? chipActiveStyle : null),
                        }}
                        onClick={() => handleZoneClick(zone)}
                      >
                        {zone}
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleSearchSubmit}>
                  <div style={searchControlRowStyle}>
                    <div style={searchFieldStyle}>
                      <input
                        type="text"
                        value={resolvedDraftQuery}
                        onChange={(event) => setDraftQuery(event.currentTarget.value)}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        onFocus={handleSearchFocus}
                        onBlur={handleSearchBlur}
                        placeholder="상품명, 제조사 검색"
                        aria-label="상품명 또는 제조사 검색"
                        style={searchInputStyle}
                      />
                      <div style={searchButtonRowStyle}>
                        {resolvedDraftQuery ? (
                          <button
                            type="button"
                            style={searchIconButtonStyle}
                            aria-label="검색어 지우기"
                            onClick={handleClearQuery}
                          >
                            <svg viewBox="0 0 24 24" style={searchIconStyle}>
                              <path
                                d="M6 6l12 12M18 6L6 18"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        ) : null}
                        <button
                          type="submit"
                          style={searchIconButtonStyle}
                          aria-label="검색"
                        >
                          <svg viewBox="0 0 24 24" style={searchIconStyle}>
                            <circle
                              cx="11"
                              cy="11"
                              r="7"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                            />
                            <path
                              d="M16.5 16.5L21 21"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <label className="productsExpiryToggle">
                      <span className="productsExpiryToggle__text">임박 상품만</span>
                      <span className="productsExpirySwitch">
                        <input
                          type="checkbox"
                          checked={isImminentOnly}
                          onChange={(event) =>
                            updateSearchParams({
                              imminent: event.currentTarget.checked,
                            })
                          }
                          aria-label="임박 상품만 보기"
                        />
                        <span className="productsExpirySwitch__slider">
                          <span className="productsExpirySwitch__circle">
                            <svg
                              className="productsExpirySwitch__cross"
                              viewBox="0 0 365.696 365.696"
                              width="6"
                              height="6"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path
                                fill="currentColor"
                                d="M243.188 182.86 356.32 69.726c12.5-12.5 12.5-32.766 0-45.247L341.238 9.398c-12.504-12.503-32.77-12.503-45.25 0L182.86 122.528 69.727 9.374c-12.5-12.5-32.766-12.5-45.247 0L9.375 24.457c-12.5 12.504-12.5 32.77 0 45.25l113.152 113.152L9.398 295.99c-12.503 12.503-12.503 32.769 0 45.25L24.48 356.32c12.5 12.5 32.766 12.5 45.247 0l113.132-113.132L295.99 356.32c12.503 12.5 32.769 12.5 45.25 0l15.081-15.082c12.5-12.504 12.5-32.77 0-45.25zm0 0"
                              />
                            </svg>
                            <svg
                              className="productsExpirySwitch__checkmark"
                              viewBox="0 0 24 24"
                              width="10"
                              height="10"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path
                                fill="currentColor"
                                d="M9.707 19.121a.997.997 0 0 1-1.414 0l-5.646-5.647a1.5 1.5 0 0 1 0-2.121l.707-.707a1.5 1.5 0 0 1 2.121 0L9 14.171l9.525-9.525a1.5 1.5 0 0 1 2.121 0l.707.707a1.5 1.5 0 0 1 0 2.121z"
                              />
                            </svg>
                          </span>
                        </span>
                      </span>
                    </label>
                  </div>
                </form>
                {expiryWarningError ? (
                  <p style={helperTextStyle}>{expiryWarningError}</p>
                ) : null}
                {isCheckModeEnabled ? (
                  <p style={helperTextStyle}>
                    재고 점검 모드 활성화 중 · 미점검 {remainingProductsCount}개
                  </p>
                ) : null}
                {isRemainingFilterDisabled ? (
                  <p style={helperTextStyle}>
                    점검 모드가 비활성화되어 있어 잔여 목록 필터를 적용할 수 없어요.
                  </p>
                ) : null}
              </div>

              {hasError ? (
                <div style={cardStyle}>
                  <p style={helperTextStyle}>
                    {errorMessage ?? "목록을 불러오지 못했어요."}
                  </p>
                </div>
              ) : shouldShowListSkeleton ? (
                <DelayedRender active={shouldShowListSkeleton} ms={150}>
                  <SkeletonList />
                </DelayedRender>
              ) : visibleProducts.length === 0 ? (
                <div style={cardStyle}>
                  <p style={helperTextStyle}>
                    {isRemainingOnly && isCheckModeEnabled
                      ? "미점검 상품이 없어요."
                      : "조건에 맞는 상품이 없어요."}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {visibleProducts.map((product) => {
                    const zoneName = product.zone_id
                      ? zoneNameById.get(product.zone_id)
                      : null;
                    const manufacturer =
                      product.manufacturer?.trim() || "제조사 미입력";
                    const stock = stockByProductId.get(product.id) ?? 0;
                    const expiryDate = product.expiry_date?.trim() ?? "";
                    const metaParts = [zoneName ?? "구역 미지정", manufacturer];
                    const unit = product.unit?.trim() ?? "";
                    if (unit) {
                      metaParts.push(unit);
                    }
                    const metaLeft = metaParts.join(" · ");
                    const expiryBadge = getExpiryBadge(
                      expiryDate,
                      expiryWarningDays
                    );
                    const photoRef = product.photo_url?.trim() ?? "";
                    const photoSrc = resolveProductPhotoUrl(photoRef);
                    const hasPhoto = photoSrc.length > 0;
                    const detailHref = `/products/${product.id}${detailQuerySuffix}`;
                    const isChecked = checkedProductIds.has(product.id);
                    return (
                      <Link
                        key={product.id}
                        href={detailHref}
                        style={{
                          display: "block",
                          color: "inherit",
                          textDecoration: "none",
                        }}
                      >
                        <div
                          style={{
                            ...cardStyle,
                            ...(isCheckModeEnabled
                              ? isChecked
                                ? cardCheckDoneStyle
                                : cardCheckPendingStyle
                              : null),
                          }}
                        >
                          <div style={cardContentStyle}>
                            <div style={thumbnailStyle}>
                              <span style={thumbnailPlaceholderStyle}>사진</span>
                              {hasPhoto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={photoSrc}
                                  alt={`${product.name} 사진`}
                                  style={thumbnailImageStyle}
                                  loading="lazy"
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : null}
                            </div>
                            <div style={cardBodyStyle}>
                              <div style={cardRowPrimaryStyle}>
                                <p style={cardTitleStyle}>{product.name}</p>
                                <div style={rightColumnStyle}>
                                  <div style={stockBlockStyle}>
                                    <p style={stockLabelStyle}>재고</p>
                                    <p style={stockValueStyle}>{stock}</p>
                                  </div>
                                </div>
                              </div>
                              <div style={cardRowSecondaryStyle}>
                                <p style={cardMetaStyle}>{metaLeft}</p>
                                <div style={rightColumnStyle}>
                                  {expiryBadge ? (
                                    <span style={expiryBadge.style}>
                                      {expiryBadge.text}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            {authState === "authed" ? (
              <Link href="/products/new" className="fabAddProduct" aria-label="제품 추가">
                <svg
                  viewBox="0 0 24 24"
                  width="26"
                  height="26"
                  aria-hidden="true"
                  focusable="false"
                  className="fabAddProduct__icon"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
