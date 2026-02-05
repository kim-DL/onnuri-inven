"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompositionEvent, CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useExpiryWarningDays } from "@/lib/useExpiryWarningDays";
import {
  ZONE_KEYWORDS,
  parseSearchTokens,
  tokensMatchText,
} from "../../lib/search";

type Zone = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  manufacturer: string | null;
  zone_id: string | null;
  expiry_date: string | null;
  photo_url: string | null;
  unit: string | null;
};

type InventoryRow = {
  product_id: string;
  stock: number;
};

type AuthState = "checking" | "authed" | "blocked" | "error";

type DataState = "idle" | "loading" | "ready" | "error";

const ZONE_PARAM_MAP = new Map(
  ZONE_KEYWORDS.map((keyword) => [keyword.toLowerCase(), keyword])
);

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F9F8F6",
  padding: "16px",
  paddingBottom: "96px",
};

const containerStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const titleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
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
};

const menuWrapperStyle: CSSProperties = {
  position: "relative",
};

const menuButtonStyle: CSSProperties = {
  minHeight: "44px",
  width: "44px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "20px",
  fontWeight: 700,
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

const floatingAddButtonStyle: CSSProperties = {
  position: "fixed",
  right: "16px",
  bottom: "16px",
  width: "48px",
  height: "48px",
  borderRadius: "12px",
  background: "transparent",
  color: "#1E2A44",
  border: "1px solid #1E2A44",
  fontSize: "26px",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  boxShadow: "0 2px 10px rgba(30, 42, 68, 0.12)",
  zIndex: 10,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function resolvePhotoUrl(photoRef: string) {
  if (!photoRef) {
    return "";
  }
  if (photoRef.startsWith("http://") || photoRef.startsWith("https://")) {
    return photoRef;
  }
  const { data } = supabase.storage.from("product-photos").getPublicUrl(photoRef);
  return data.publicUrl ?? "";
}
function normalizeZoneParam(zoneParam: string | null): string | null {
  if (!zoneParam) {
    return null;
  }
  const match = ZONE_PARAM_MAP.get(zoneParam.toLowerCase());
  return match ?? null;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedZone = normalizeZoneParam(searchParams.get("zone"));
  const query = searchParams.get("q") ?? "";
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [dataState, setDataState] = useState<DataState>("idle");
  const [zones, setZones] = useState<Zone[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockByProductId, setStockByProductId] = useState<Map<string, number>>(
    new Map()
  );
  const expiryWarning = useExpiryWarningDays({
    enabled: authState === "authed",
  });
  const expiryWarningDays = expiryWarning.value;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState(query);
  const [isComposing, setIsComposing] = useState(false);
  const isComposingRef = useRef(false);
  const pendingUpdatesRef = useRef<{ zone?: string | null; q?: string } | null>(
    null
  );

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

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

    let cancelled = false;

    const loadData = async () => {
      setDataState("loading");
      setErrorMessage(null);

      const [zonesResult, productsResult, inventoryResult] = await Promise.all(
        [
          supabase.from("zones").select("id, name").order("sort_order"),
          supabase
            .from("products")
            .select("id, name, manufacturer, zone_id, expiry_date, photo_url, unit")
            .eq("active", true)
            .order("name"),
          supabase.from("inventory").select("product_id, stock"),
        ]
      );

      if (cancelled) {
        return;
      }

      if (zonesResult.error || productsResult.error || inventoryResult.error) {
        if (zonesResult.error) {
          console.error("Failed to fetch zones", zonesResult.error);
        }
        if (productsResult.error) {
          console.error("Failed to fetch products", productsResult.error);
        }
        if (inventoryResult.error) {
          console.error("Failed to fetch inventory", inventoryResult.error);
        }
        setErrorMessage("상품 목록을 불러오지 못했어요.");
        setDataState("error");
        return;
      }

      const stockMap = new Map<string, number>();
      (inventoryResult.data as InventoryRow[] | null | undefined)?.forEach(
        (row) => {
          stockMap.set(row.product_id, row.stock);
        }
      );

      setZones(zonesResult.data ?? []);
      setProducts(productsResult.data ?? []);
      setStockByProductId(stockMap);
      setDataState("ready");
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [authState]);

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
  const shouldApplyZone = committedQuery.length === 0;
  const activeZone = shouldApplyZone ? selectedZone : null;

  const filteredProducts = useMemo(() => {
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

  const isLoading =
    authState === "checking" ||
    (authState === "authed" && (dataState === "idle" || dataState === "loading"));

  const hasError =
    authState === "error" || (authState === "authed" && dataState === "error");

  const expiryWarningError =
    authState === "authed" && expiryWarning.status === "error"
      ? "유통기한 기준을 불러오지 못했어요."
      : null;

  const detailQuery = searchParams.toString();
  const detailQuerySuffix = detailQuery ? `?${detailQuery}` : "";
  const archivedHref = detailQuery
    ? `/products/archived?${detailQuery}`
    : "/products/archived";
  const settingsHref = detailQuery ? `/settings?${detailQuery}` : "/settings";

  const updateSearchParams = useCallback(
    (updates: { zone?: string | null; q?: string }) => {
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

      const nextUrl = nextParams.toString()
        ? `${pathname}?${nextParams.toString()}`
        : pathname;
      router.replace(nextUrl);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (isComposing) {
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
  }, [committedQuery, draftQuery, isComposing, updateSearchParams]);

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

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = draftQuery.trim();
    if (nextQuery === committedQuery) {
      return;
    }
    updateSearchParams({ q: nextQuery });
  };

  const handleClearQuery = () => {
    if (!draftQuery) {
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
    const rows = filteredProducts.map((product) => {
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
    <div style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerBarStyle}>
          <h1 style={titleStyle}>상품 목록</h1>
          {authState !== "blocked" ? (
            <div style={headerActionRowStyle}>
              <div style={menuWrapperStyle}>
                <button
                  type="button"
                  style={menuButtonStyle}
                  aria-label="메뉴 열기"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                >
                  ☰
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
              <div style={searchFieldStyle}>
                <input
                  type="text"
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.currentTarget.value)}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  placeholder="상품명, 제조사 검색"
                  aria-label="상품명 또는 제조사 검색"
                  style={searchInputStyle}
                />
                <div style={searchButtonRowStyle}>
                  {draftQuery ? (
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
            </form>
            {expiryWarningError ? (
              <p style={helperTextStyle}>{expiryWarningError}</p>
            ) : null}

            {isLoading ? (
              <SkeletonList />
            ) : hasError ? (
              <div style={cardStyle}>
                <p style={helperTextStyle}>
                  {errorMessage ?? "목록을 불러오지 못했어요."}
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={cardStyle}>
                <p style={helperTextStyle}>조건에 맞는 상품이 없어요.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {filteredProducts.map((product) => {
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
                  const daysLeft = expiryDate ? getDaysLeft(expiryDate) : null;
                  let expiryBadge: { text: string; style: CSSProperties } | null =
                    null;
                  if (daysLeft !== null) {
                    if (daysLeft < 0) {
                      expiryBadge = { text: "만료", style: badgeExpiredStyle };
                    } else if (daysLeft <= expiryWarningDays) {
                      expiryBadge = {
                        text: `임박 D-${daysLeft}`,
                        style: badgeWarningStyle,
                      };
                    }
                  }
                  const photoRef = product.photo_url?.trim() ?? "";
                  const photoSrc = photoRef ? resolvePhotoUrl(photoRef) : "";
                  const hasPhoto = photoSrc.length > 0;
                  const detailHref = `/products/${product.id}${detailQuerySuffix}`;
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
                      <div style={cardStyle}>
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
            {authState === "authed" ? (
              <Link
                href="/products/new"
                style={floatingAddButtonStyle}
                aria-label="제품 추가"
              >
                +
              </Link>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
