"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import {
  ZONE_KEYWORDS,
  extractZoneOverride,
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
};

type AuthState = "checking" | "authed" | "blocked" | "error";

type DataState = "idle" | "loading" | "ready" | "error";

const ZONE_PARAM_MAP = new Map(
  ZONE_KEYWORDS.map((keyword) => [keyword.toLowerCase(), keyword])
);

const ZONE_TOKEN_SET = new Set(
  ZONE_KEYWORDS.map((keyword) => keyword.toLowerCase())
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
  borderColor: "#2E2A27",
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

const cardTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
};

const cardMetaStyle: CSSProperties = {
  fontSize: "13px",
  color: "#5A514B",
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      const [zonesResult, productsResult] = await Promise.all([
        supabase.from("zones").select("id, name").order("sort_order"),
        supabase
          .from("products")
          .select("id, name, manufacturer, zone_id")
          .eq("active", true)
          .order("name"),
      ]);

      if (cancelled) {
        return;
      }

      if (zonesResult.error || productsResult.error) {
        if (zonesResult.error) {
          console.error("Failed to fetch zones", zonesResult.error);
        }
        if (productsResult.error) {
          console.error("Failed to fetch products", productsResult.error);
        }
        setErrorMessage("상품 목록을 불러오지 못했어요.");
        setDataState("error");
        return;
      }

      setZones(zonesResult.data ?? []);
      setProducts(productsResult.data ?? []);
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

  const tokens = useMemo(() => parseSearchTokens(query), [query]);
  const zoneOverride = useMemo(() => extractZoneOverride(tokens), [tokens]);
  const textTokens = useMemo(
    () => tokens.filter((token) => !ZONE_TOKEN_SET.has(token)),
    [tokens]
  );

  const effectiveZone = zoneOverride ?? selectedZone;

  const filteredProducts = useMemo(() => {
    if (products.length === 0) {
      return [];
    }

    return products.filter((product) => {
      const zoneName = product.zone_id
        ? zoneNameById.get(product.zone_id)
        : null;

      if (effectiveZone && zoneName !== effectiveZone) {
        return false;
      }

      const haystack = `${product.name} ${product.manufacturer ?? ""}`;
      return tokensMatchText(haystack, textTokens);
    });
  }, [effectiveZone, products, textTokens, zoneNameById]);

  const isLoading =
    authState === "checking" ||
    (authState === "authed" && (dataState === "idle" || dataState === "loading"));

  const hasError =
    authState === "error" || (authState === "authed" && dataState === "error");

  const updateSearchParams = (updates: { zone?: string | null; q?: string }) => {
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
  };

  const handleZoneClick = (zone: string) => {
    const nextZone = selectedZone === zone ? null : zone;
    updateSearchParams({ zone: nextZone });
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Failed to sign out", error);
    }
    router.replace("/login");
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <header>
          <h1 style={titleStyle}>상품 목록</h1>
        </header>

        {authState === "blocked" ? (
          <div style={{ ...cardStyle, gap: "12px" }}>
            <p style={helperTextStyle}>
              계정이 비활성화되어 있어 접근할 수 없어요.
            </p>
            <button type="button" style={buttonStyle} onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        ) : (
          <>
            <div style={chipRowStyle}>
              {ZONE_KEYWORDS.map((zone) => {
                const isActive = effectiveZone === zone;
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
              value={query}
              onChange={(event) => updateSearchParams({ q: event.target.value })}
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
                  const manufacturer = product.manufacturer ?? "제조사 미입력";
                  return (
                    <div key={product.id} style={cardStyle}>
                      <p style={cardTitleStyle}>{product.name}</p>
                      <p style={cardMetaStyle}>{manufacturer}</p>
                      <p style={cardMetaStyle}>{zoneName ?? "구역 미지정"}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
