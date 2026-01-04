"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import {
  ZONE_KEYWORDS,
  extractZoneOverride,
  parseSearchTokens,
  tokensMatchText,
  type ZoneKeyword,
} from "@/lib/search";

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

const TOKEN_ZONE_SET = new Set<string>(ZONE_KEYWORDS);

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [profileStatus, setProfileStatus] = useState<
    "loading" | "ok" | "inactive" | "missing" | "error"
  >("loading");
  const [zones, setZones] = useState<Zone[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState<string>(
    searchParams.get("q") ?? "",
  );

  useEffect(() => {
    setSearchInput(searchParams.get("q") ?? "");
  }, [searchParams]);

  const queryZone = searchParams.get("zone");
  const querySearch = searchParams.get("q") ?? "";
  const tokens = useMemo(() => parseSearchTokens(querySearch), [querySearch]);
  const overrideZone = extractZoneOverride(tokens);
  const effectiveZone =
    overrideZone ?? (TOKEN_ZONE_SET.has(queryZone ?? "") ? queryZone : null);

  const zoneMapById = useMemo(() => {
    const map: Record<string, string> = {};
    zones.forEach((zone) => {
      map[zone.id] = zone.name;
    });
    return map;
  }, [zones]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (effectiveZone) {
        const productZoneName =
          (product.zone_id && zoneMapById[product.zone_id]) || null;
        if (productZoneName !== effectiveZone) return false;
      }

      if (tokens.length === 0) {
        return true;
      }

      const text = `${product.name} ${product.manufacturer ?? ""}`;
      return tokensMatchText(text, tokens);
    });
  }, [effectiveZoneId, products, tokens]);

  const updateQuery = useCallback(
    (nextZone: string | null, nextSearch: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextZone) {
        params.set("zone", nextZone);
      } else {
        params.delete("zone");
      }

      if (nextSearch.trim().length > 0) {
        params.set("q", nextSearch);
      } else {
        params.delete("q");
      }

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const handleZoneSelect = (zoneName: string) => {
    if (zoneName === queryZone) {
      updateQuery(null, searchInput);
      return;
    }

    updateQuery(zoneName, searchInput);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    updateQuery(queryZone, value);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setDataLoading(true);
      setErrorMessage(null);

      const { user, error: sessionError } = await getSessionUser();
      if (!active) return;

      if (sessionError) {
        console.error("세션 확인 실패", sessionError);
        setErrorMessage("로그인 상태를 확인할 수 없습니다.");
        setDataLoading(false);
        setProfileStatus("error");
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { profile, error: profileError } = await getUserProfile(user.id);
      if (!active) return;

      if (profileError) {
        console.error("프로필 조회 실패", profileError);
        setErrorMessage("프로필을 불러오지 못했습니다.");
        setProfileStatus("error");
        setDataLoading(false);
        return;
      }

      if (!profile) {
        setProfileStatus("missing");
        setDataLoading(false);
        return;
      }

      if (profile.active === false) {
        setProfileStatus("inactive");
        setDataLoading(false);
        return;
      }

      setProfileStatus("ok");

      const [{ data: zoneData, error: zoneError }, { data: productData, error: productError }] =
        await Promise.all([
          supabase
            .from("zones")
            .select("id, name")
            .eq("active", true)
            .order("sort_order", { ascending: true }),
          supabase
            .from("products")
            .select("id, name, manufacturer, zone_id")
            .eq("active", true),
        ]);

      if (!active) return;

      if (zoneError || productError) {
        if (zoneError?.status === 401 || productError?.status === 401) {
          router.replace("/login");
          return;
        }

        console.error("목록 조회 실패", { zoneError, productError });
        setErrorMessage("목록을 불러오지 못했습니다.");
        setDataLoading(false);
        return;
      }

      setZones(zoneData ?? []);
      setProducts(productData ?? []);
      setDataLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [router]);

  const showSkeleton = dataLoading && profileStatus === "ok";

  const renderState = () => {
    if (profileStatus === "loading") {
      return <SkeletonList />;
    }

    if (profileStatus === "missing") {
      return (
        <BlockedState
          message="프로필이 설정되지 않았습니다. 관리자에게 문의하세요."
          onSignOut={handleSignOut}
        />
      );
    }

    if (profileStatus === "inactive") {
      return (
        <BlockedState
          message="접근이 제한되었습니다(비활성 계정)."
          onSignOut={handleSignOut}
        />
      );
    }

    if (profileStatus === "error" && errorMessage) {
      return (
        <ErrorState
          message={errorMessage}
          onRetry={null}
        />
      );
    }

    if (showSkeleton) {
      return <SkeletonList />;
    }

    if (errorMessage) {
      return (
        <ErrorState
          message={errorMessage}
          onRetry={null}
        />
      );
    }

    if (!dataLoading && filteredProducts.length === 0) {
      return <EmptyState />;
    }

    return (
      <div className="space-y-3">
        {filteredProducts.map((product) => (
          <article
            key={product.id}
            className="rounded-2xl bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-gray-900">
                  {product.name}
                </h2>
                {product.manufacturer ? (
                  <p className="text-sm text-gray-600">{product.manufacturer}</p>
                ) : null}
              </div>
              {product.zone_id ? (
                <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                  {zoneMapById[product.zone_id] ?? "미지정"}
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="space-y-3">
          <h1 className="text-lg font-semibold text-gray-900">상품 목록</h1>
          <ZoneChips
            activeZone={effectiveZone}
            onSelect={handleZoneSelect}
          />
          <SearchInput
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="상품명, 제조사 검색 (쉼표나 띄어쓰기로 구분)"
          />
          {overrideZone ? (
            <p className="text-xs text-gray-600">
              검색어에 포함된 구역 키워드로 필터가 적용됩니다: {overrideZone}
            </p>
          ) : null}
        </header>
        {renderState()}
      </div>
    </div>
  );
}

type ZoneChipsProps = {
  activeZone: string | null;
  onSelect: (zone: ZoneKeyword) => void;
};

function ZoneChips({ activeZone, onSelect }: ZoneChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ZONE_KEYWORDS.map((zone) => {
        const isActive = activeZone === zone;
        return (
          <button
            key={zone}
            type="button"
            onClick={() => onSelect(zone)}
            className={`h-11 min-w-[72px] rounded-full border px-4 text-sm font-medium transition-colors ${isActive
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-800"
              }`}
          >
            {zone}
          </button>
        );
      })}
    </div>
  );
}

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="flex w-full items-center rounded-full bg-white px-4 py-2 shadow-sm">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-full text-sm text-gray-900 outline-none placeholder:text-gray-500"
        placeholder={placeholder}
      />
    </div>
  );
}

type BlockedStateProps = {
  message: string;
  onSignOut: () => void;
};

function BlockedState({ message, onSignOut }: BlockedStateProps) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
      <p className="text-sm font-medium text-gray-900">{message}</p>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-4 h-11 w-full rounded-full bg-gray-900 text-sm font-semibold text-white"
      >
        로그아웃
      </button>
    </div>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry: null | (() => void);
};

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
      <p className="text-sm font-medium text-gray-900">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-11 w-full rounded-full bg-gray-900 text-sm font-semibold text-white"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
      <p className="text-sm font-medium text-gray-900">
        조회된 상품이 없습니다.
      </p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="h-20 rounded-2xl bg-white p-4 shadow-sm"
        >
          <div className="h-full w-full animate-pulse rounded-xl bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
