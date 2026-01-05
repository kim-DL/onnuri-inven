"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompositionEvent, CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
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
};

const containerStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
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
  gap: "12px",
};

const headerActionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const chipBaseStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const chipActiveStyle: CSSProperties = {
  background: "#2E2A27",
  color: "#FFFFFF",
  border: "1px solid #2E2A27",
};

const inputStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  fontSize: "15px",
  background: "#FFFFFF",
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

const cardContentStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "64px minmax(0, 1fr)",
  gap: "12px",
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
  gap: "6px",
  minWidth: 0,
};

const cardRowPrimaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "start",
  gap: "8px",
};

const cardRowSecondaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "8px",
};

const cardTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
  lineHeight: 1.3,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardMetaStyle: CSSProperties = {
  fontSize: "13px",
  color: "#5A514B",
  margin: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const stockBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "2px",
  minWidth: "64px",
  textAlign: "right",
};

const stockLabelStyle: CSSProperties = {
  fontSize: "11px",
  color: "#7B736C",
  margin: 0,
  whiteSpace: "nowrap",
};

const stockValueStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#2E2A27",
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

const archivedLinkStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "999px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const floatingAddButtonStyle: CSSProperties = {
  position: "fixed",
  right: "16px",
  bottom: "16px",
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  background: "#2E2A27",
  color: "#FFFFFF",
  fontSize: "28px",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  boxShadow: "0 6px 16px rgba(46, 42, 39, 0.25)",
  zIndex: 10,
};

const EXPIRY_WARNING_DAYS = 100;
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
function normalizeZoneParam(zoneParam: string | null): string | null {
  if (!zoneParam) {
    return null;
  }
  const match = ZONE_PARAM_MAP.get(zoneParam.toLowerCase());
  return match ?? null;
}

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
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

      const [zonesResult, productsResult, inventoryResult] = await Promise.all([
        supabase.from("zones").select("id, name").order("sort_order"),
        supabase
          .from("products")
          .select("id, name, manufacturer, zone_id, expiry_date, photo_url")
          .eq("active", true)
          .order("name"),
        supabase.from("inventory").select("product_id, stock"),
      ]);

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

  const detailQuery = searchParams.toString();
  const detailQuerySuffix = detailQuery ? `?${detailQuery}` : "";
  const archivedHref = detailQuery
    ? `/products/archived?${detailQuery}`
    : "/products/archived";

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

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerBarStyle}>
          <h1 style={titleStyle}>상품 목록</h1>
          {authState !== "blocked" ? (
            <div style={headerActionRowStyle}>
              <Link href={archivedHref} style={archivedLinkStyle}>
                비활성화 목록
              </Link>
              <button type="button" style={logoutButtonStyle} onClick={handleLogout}>
                로그아웃
              </button>
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
                style={{
                  ...chipBaseStyle,
                  ...(!selectedZone ? chipActiveStyle : null),
                }}
                onClick={() => updateSearchParams({ zone: null })}
              >
                All
              </button>
              {ZONE_KEYWORDS.map((zone) => {
                const isActive = selectedZone === zone;
                return (
                  <button
                    key={zone}
                    type="button"
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

            <input
              type="text"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.currentTarget.value)}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="상품명, 제조사 검색"
              aria-label="상품명 또는 제조사 검색"
              style={inputStyle}
            />

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
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredProducts.map((product) => {
                  const zoneName = product.zone_id
                    ? zoneNameById.get(product.zone_id)
                    : null;
                  const manufacturer =
                    product.manufacturer?.trim() || "제조사 미입력";
                  const stock = stockByProductId.get(product.id) ?? 0;
                  const expiryDate = product.expiry_date?.trim() ?? "";
                  const metaParts = [manufacturer, zoneName ?? "구역 미지정"];
                  if (expiryDate) {
                    metaParts.push(expiryDate);
                  }
                  const metaLeft = metaParts.join(" · ");
                  const daysLeft = expiryDate ? getDaysLeft(expiryDate) : null;
                  let expiryBadge: { text: string; style: CSSProperties } | null =
                    null;
                  if (daysLeft !== null) {
                    if (daysLeft < 0) {
                      expiryBadge = { text: "만료", style: badgeExpiredStyle };
                    } else if (daysLeft <= EXPIRY_WARNING_DAYS) {
                      expiryBadge = {
                        text: `임박 D-${daysLeft}`,
                        style: badgeWarningStyle,
                      };
                    }
                  }
                  const photoUrl = product.photo_url?.trim() ?? "";
                  const hasPhoto = photoUrl.length > 0;
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
                                src={photoUrl}
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
                              <div style={stockBlockStyle}>
                                <p style={stockLabelStyle}>재고</p>
                                <p style={stockValueStyle}>{stock}</p>
                              </div>
                            </div>
                            <div style={cardRowSecondaryStyle}>
                              <p style={cardMetaStyle}>{metaLeft}</p>
                              {expiryBadge ? (
                                <span style={expiryBadge.style}>
                                  {expiryBadge.text}
                                </span>
                              ) : null}
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
