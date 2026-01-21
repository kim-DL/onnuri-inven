"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type AuthState = "checking" | "authed" | "blocked" | "error";

type DataState = "idle" | "loading" | "ready" | "error";

type Zone = {
  id: string;
  name: string;
};

type ZoneCount = {
  zone: Zone;
  count: number | null;
  hasError: boolean;
};

type InventoryRow = {
  product_id: string;
  stock: number;
};

type RecentActivityRow = {
  id: string;
  product_id: string;
  product_name: string;
  delta: number;
  note: string | null;
  created_at: string;
  created_by: string | null;
  actor_name: string | null;
};

type ActivityType = "IN" | "OUT" | "ADJUST";

type ZoneKpi = {
  label: string;
  count: number | null;
  hasError: boolean;
};

const ZONE_KPI_LABELS = ["냉동1", "냉동2", "냉장", "상온"] as const;

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#F9F8F6",
  backgroundImage:
    "radial-gradient(820px 260px at 50% -90px, rgba(255, 255, 255, 0.9), rgba(249, 248, 246, 0)), linear-gradient(180deg, #FAF9F7 0%, #F9F8F6 40%, #F5F1EC 100%)",
  padding: "16px",
  paddingBottom: "32px",
  color: "#2E2A27",
};

const containerStyle: CSSProperties = {
  maxWidth: "760px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const headerShellStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  padding: "10px 0 8px",
  background: "rgba(249, 248, 246, 0.96)",
  backdropFilter: "blur(6px)",
  borderBottom: "1px solid rgba(227, 222, 216, 0.7)",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
};

const headerLeftStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  margin: 0,
  letterSpacing: "-0.02em",
};

const headerMetaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px",
};

const headerDateStyle: CSSProperties = {
  fontSize: "13px",
  color: "#6B625B",
  margin: 0,
};

const headerButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid #D9D3CC",
  background: "linear-gradient(180deg, #FFFFFF 0%, #F2EDE7 100%)",
  color: "#2E2A27",
  fontSize: "13px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
  boxShadow: "0 6px 18px rgba(32, 26, 20, 0.12)",
};

const totalPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "4px 10px",
  borderRadius: "999px",
  border: "1px solid #E3DED8",
  background: "rgba(255, 255, 255, 0.9)",
  boxShadow: "0 4px 12px rgba(32, 26, 20, 0.08)",
};

const totalPillLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#6B625B",
  margin: 0,
};

const totalPillValueStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#2E2A27",
  margin: 0,
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
};

const cardBaseStyle: CSSProperties = {
  borderRadius: "24px",
  border: "1px solid rgba(227, 222, 216, 0.9)",
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 10px 24px rgba(32, 26, 20, 0.08)",
};

const cardStyle: CSSProperties = {
  ...cardBaseStyle,
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
  letterSpacing: "-0.01em",
};

const helperTextStyle: CSSProperties = {
  fontSize: "13px",
  color: "#6B625B",
  margin: 0,
};

const kpiGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const kpiCardLinkStyle: CSSProperties = {
  ...cardBaseStyle,
  padding: "16px 18px",
  minHeight: "120px",
  textDecoration: "none",
  color: "inherit",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: "6px",
};

const kpiLabelStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#6B625B",
  margin: 0,
};

const kpiValueStyle: CSSProperties = {
  fontSize: "44px",
  fontWeight: 700,
  margin: 0,
  lineHeight: 0.95,
  letterSpacing: "-0.03em",
  fontVariantNumeric: "tabular-nums",
};

const listCardStyle: CSSProperties = {
  ...cardBaseStyle,
  padding: "4px 0",
  overflow: "hidden",
};

const activityRowStyle: CSSProperties = {
  padding: "12px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  borderLeft: "3px solid transparent",
};

const activityTopRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "start",
  gap: "10px",
};

const activityTitleStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  margin: 0,
  lineHeight: 1.3,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const activityValueWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "8px",
  whiteSpace: "nowrap",
};

const activityDeltaStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
  letterSpacing: "-0.02em",
  fontVariantNumeric: "tabular-nums",
};

const activityStockStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#6B625B",
  margin: 0,
};

const activityMetaStyle: CSSProperties = {
  fontSize: "12px",
  color: "#7B736C",
  margin: 0,
};

const statusBadgeBaseStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  padding: "4px 10px",
  borderRadius: "999px",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
};

const statusBadgePositiveStyle: CSSProperties = {
  ...statusBadgeBaseStyle,
  background: "#EAF4EC",
  borderColor: "#CBE7D5",
  color: "#2F6F46",
};

const statusBadgeNeutralStyle: CSSProperties = {
  ...statusBadgeBaseStyle,
  background: "#F2F1EF",
  borderColor: "#E0DBD4",
  color: "#6B625B",
};

const statusBadgeErrorStyle: CSSProperties = {
  ...statusBadgeBaseStyle,
  background: "#F8EDEC",
  borderColor: "#F1D1CD",
  color: "#9B2C2C",
};

const typeBadgeBaseStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: "999px",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
};

const TYPE_BADGE_STYLES: Record<ActivityType, CSSProperties> = {
  IN: {
    ...typeBadgeBaseStyle,
    background: "#F8F6F2",
    borderColor: "#E3DED8",
    color: "#5A514B",
  },
  OUT: {
    ...typeBadgeBaseStyle,
    background: "#F8F6F2",
    borderColor: "#E3DED8",
    color: "#5A514B",
  },
  ADJUST: {
    ...typeBadgeBaseStyle,
    background: "#EEF2F6",
    borderColor: "#D6DEE7",
    color: "#3F4854",
  },
};

const TYPE_BORDER_COLORS: Record<ActivityType, string> = {
  IN: "#EFEAE3",
  OUT: "#EFEAE3",
  ADJUST: "#D5DCE6",
};

const skeletonBlockStyle: CSSProperties = {
  background: "linear-gradient(120deg, #EAE5DF 0%, #F2EDE7 100%)",
  borderRadius: "12px",
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  IN: "입고",
  OUT: "출고",
  ADJUST: "조정",
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateLabel(value: { year: number; month: number; day: number }) {
  return `${value.year}-${pad2(value.month)}-${pad2(value.day)}`;
}

function getMostRecentFridayKst(base: Date) {
  const kstDate = new Date(base.getTime() + KST_OFFSET_MS);
  const dayOfWeek = kstDate.getUTCDay();
  const diff = (dayOfWeek - 5 + 7) % 7;
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth();
  const day = kstDate.getUTCDate();
  const fridayUtc = new Date(Date.UTC(year, month, day) - diff * MS_PER_DAY);

  return {
    year: fridayUtc.getUTCFullYear(),
    month: fridayUtc.getUTCMonth() + 1,
    day: fridayUtc.getUTCDate(),
  };
}

function getFridayRangeKst() {
  const friday = getMostRecentFridayKst(new Date());
  const label = formatDateLabel(friday);
  const start = `${label}T00:00:00+09:00`;
  const fridayUtc = Date.UTC(friday.year, friday.month - 1, friday.day);
  const nextDay = new Date(fridayUtc + MS_PER_DAY);
  const endLabel = formatDateLabel({
    year: nextDay.getUTCFullYear(),
    month: nextDay.getUTCMonth() + 1,
    day: nextDay.getUTCDate(),
  });

  return {
    label,
    start,
    end: `${endLabel}T00:00:00+09:00`,
  };
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ko-KR");
}

function getActivityType(activity: RecentActivityRow): ActivityType {
  const note = activity.note?.trim();
  if (note === "ADJUST") {
    return "ADJUST";
  }
  if (activity.delta > 0) {
    return "IN";
  }
  if (activity.delta < 0) {
    return "OUT";
  }
  return "ADJUST";
}

function getActorLabel(activity: RecentActivityRow) {
  const actorName = activity.actor_name?.trim();
  if (actorName) {
    return actorName;
  }
  const createdBy = activity.created_by?.trim();
  if (createdBy) {
    return createdBy.slice(0, 8);
  }
  return "이름 미입력";
}

function formatDelta(delta: number) {
  if (delta > 0) {
    return `+${delta}`;
  }
  return `${delta}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

function KpiSkeleton() {
  return (
    <div style={kpiGridStyle}>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} style={kpiCardLinkStyle}>
          <div style={{ ...skeletonBlockStyle, height: "14px", width: "40%" }} />
          <div style={{ ...skeletonBlockStyle, height: "34px", width: "60%" }} />
        </div>
      ))}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          style={{
            ...activityRowStyle,
            borderBottom: "1px solid #EFEAE3",
          }}
        >
          <div style={{ ...skeletonBlockStyle, height: "14px", width: "70%" }} />
          <div style={{ ...skeletonBlockStyle, height: "12px", width: "40%" }} />
        </div>
      ))}
    </>
  );
}

export default function DashboardClient() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const [totalState, setTotalState] = useState<DataState>("idle");
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalError, setTotalError] = useState<string | null>(null);

  const [zoneState, setZoneState] = useState<DataState>("idle");
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [zoneCounts, setZoneCounts] = useState<ZoneCount[]>([]);
  const [zoneWarning, setZoneWarning] = useState<string | null>(null);

  const [activityState, setActivityState] = useState<DataState>("idle");
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activities, setActivities] = useState<RecentActivityRow[]>([]);

  const [stockByProductId, setStockByProductId] = useState<Map<string, number>>(
    () => new Map()
  );

  const [fridayState, setFridayState] = useState<DataState>("idle");
  const [fridayError, setFridayError] = useState<string | null>(null);
  const [fridayAdjustCount, setFridayAdjustCount] = useState<number | null>(null);

  const fridayRange = useMemo(() => getFridayRangeKst(), []);

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
        const { error: signOutFailure } = await signOut();
        if (signOutFailure) {
          console.error("Failed to sign out", signOutFailure);
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

    const loadDashboard = async () => {
      setTotalState("loading");
      setTotalError(null);
      setZoneState("loading");
      setZoneError(null);
      setZoneWarning(null);
      setActivityState("loading");
      setActivityError(null);
      setFridayState("loading");
      setFridayError(null);

      const totalPromise = supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("active", true);

      const zonesPromise = supabase
        .from("zones")
        .select("id, name")
        .eq("active", true)
        .order("sort_order");

      const activityPromise = supabase.rpc("list_recent_inventory_activity", {
        p_limit: 20,
      });

      const fridayPromise = supabase
        .from("inventory_logs")
        .select("id", { count: "exact", head: true })
        .eq("note", "ADJUST")
        .gte("created_at", fridayRange.start)
        .lt("created_at", fridayRange.end);

      const [totalResult, zonesResult, activityResult, fridayResult] =
        await Promise.all([
          totalPromise,
          zonesPromise,
          activityPromise,
          fridayPromise,
        ]);

      if (cancelled) {
        return;
      }

      if (totalResult.error) {
        console.error("Failed to fetch product count", totalResult.error);
        setTotalError("전체 제품 수를 불러오지 못했어요.");
        setTotalState("error");
      } else {
        setTotalCount(totalResult.count ?? 0);
        setTotalState("ready");
      }

      let activityData: RecentActivityRow[] = [];

      if (activityResult.error) {
        console.error("Failed to fetch recent activity", activityResult.error);
        setActivityError("최근 활동을 불러오지 못했어요.");
        setActivityState("error");
      } else {
        activityData =
          (activityResult.data as RecentActivityRow[] | null | undefined) ?? [];
        setActivities(activityData);
        setActivityState("ready");
      }

      if (fridayResult.error) {
        console.error("Failed to fetch adjust count", fridayResult.error);
        setFridayError("조정 발생 여부를 불러오지 못했어요.");
        setFridayState("error");
      } else {
        setFridayAdjustCount(fridayResult.count ?? 0);
        setFridayState("ready");
      }

      if (zonesResult.error) {
        console.error("Failed to fetch zones", zonesResult.error);
        setZoneError("구역 정보를 불러오지 못했어요.");
        setZoneState("error");
      } else {
        const zonesData = (zonesResult.data as Zone[] | null | undefined) ?? [];
        if (zonesData.length === 0) {
          setZoneCounts([]);
          setZoneState("ready");
        } else {
          const zoneCountResults = await Promise.all(
            zonesData.map(async (zone) => {
              const { count, error } = await supabase
                .from("products")
                .select("id", { count: "exact", head: true })
                .eq("active", true)
                .eq("zone_id", zone.id);

              if (error) {
                console.error("Failed to fetch zone count", {
                  zoneId: zone.id,
                  error,
                });
                return { zone, count: null, hasError: true };
              }

              return { zone, count: count ?? 0, hasError: false };
            })
          );

          if (cancelled) {
            return;
          }

          setZoneCounts(zoneCountResults);
          if (zoneCountResults.some((row) => row.hasError)) {
            setZoneWarning("일부 구역 집계에 실패했어요.");
          }
          setZoneState("ready");
        }
      }

      if (activityData.length === 0) {
        setStockByProductId(new Map());
        return;
      }

      const productIds = Array.from(
        new Set(activityData.map((item) => item.product_id))
      );

      const inventoryResult = await supabase
        .from("inventory")
        .select("product_id, stock")
        .in("product_id", productIds);

      if (cancelled) {
        return;
      }

      if (inventoryResult.error) {
        console.error("Failed to fetch inventory", inventoryResult.error);
        setStockByProductId(new Map());
        return;
      }

      const stockMap = new Map<string, number>();
      (inventoryResult.data as InventoryRow[] | null | undefined)?.forEach(
        (row) => {
          stockMap.set(row.product_id, row.stock);
        }
      );
      setStockByProductId(stockMap);
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authState, fridayRange.end, fridayRange.start]);

  const isAuthLoading = authState === "checking";

  const adjustBadge = (() => {
    if (fridayState === "error") {
      return { text: "확인 실패", style: statusBadgeErrorStyle };
    }
    if (fridayState !== "ready") {
      return { text: "확인 중", style: statusBadgeNeutralStyle };
    }
    if ((fridayAdjustCount ?? 0) >= 1) {
      return { text: "조정 발생: 있음", style: statusBadgePositiveStyle };
    }
    return { text: "조정 발생: 없음", style: statusBadgeNeutralStyle };
  })();

  const totalPillValue = useMemo(() => {
    if (totalState === "ready") {
      return formatNumber(totalCount ?? 0);
    }
    if (totalState === "error") {
      return "-";
    }
    return "...";
  }, [totalCount, totalState]);

  const zoneKpis = useMemo<ZoneKpi[]>(() => {
    const map = new Map<string, ZoneCount>();
    zoneCounts.forEach((row) => {
      map.set(row.zone.name, row);
    });

    return ZONE_KPI_LABELS.map((label) => {
      const row = map.get(label);
      return {
        label,
        count: row?.count ?? 0,
        hasError: zoneState === "error" || row?.hasError === true,
      };
    });
  }, [zoneCounts, zoneState]);

  const fridayLabel = fridayRange.label;

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

  if (authState === "blocked") {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={cardStyle}>
            <p style={helperTextStyle}>
              계정이 비활성화되어 있어 접근할 수 없어요.
            </p>
            <button type="button" style={headerButtonStyle} onClick={handleLogout}>
              로그아웃
            </button>
            {signOutError ? <p style={helperTextStyle}>{signOutError}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (authState === "error") {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={cardStyle}>
            <p style={helperTextStyle}>
              {errorMessage ?? "대시보드를 불러오지 못했어요."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerShellStyle}>
          <div style={headerRowStyle}>
            <div style={headerLeftStyle}>
              <h1 style={titleStyle}>대시보드</h1>
              <div style={headerMetaRowStyle}>
                <p style={headerDateStyle}>기준일: {fridayLabel} (금)</p>
                <span style={adjustBadge.style}>{adjustBadge.text}</span>
              </div>
            </div>
            <Link href="/products" style={headerButtonStyle}>
              제품목록
            </Link>
          </div>
          {totalState === "error" && totalError ? (
            <p style={helperTextStyle}>{totalError}</p>
          ) : null}
          {fridayState === "error" && fridayError ? (
            <p style={helperTextStyle}>{fridayError}</p>
          ) : null}
        </header>

        {signOutError ? <p style={helperTextStyle}>{signOutError}</p> : null}

        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>구역별 현황</h2>
            <div style={totalPillStyle}>
              <span style={totalPillLabelStyle}>전체 제품</span>
              <span style={totalPillValueStyle}>{totalPillValue}</span>
            </div>
          </div>
          {isAuthLoading || zoneState === "loading" || zoneState === "idle" ? (
            <KpiSkeleton />
          ) : (
            <div style={kpiGridStyle}>
              {zoneKpis.map((item) => {
                const href = `/products?zone=${encodeURIComponent(item.label)}`;
                const valueLabel = item.hasError
                  ? "-"
                  : formatNumber(item.count ?? 0);

                return (
                  <Link
                    key={item.label}
                    href={href}
                    style={kpiCardLinkStyle}
                    className="dashboard-pressable"
                    aria-label={`${item.label} 제품 목록 보기`}
                  >
                    <p style={kpiLabelStyle}>{item.label}</p>
                    <p style={kpiValueStyle}>{valueLabel}</p>
                  </Link>
                );
              })}
            </div>
          )}
          {zoneState === "error" && zoneError ? (
            <p style={helperTextStyle}>{zoneError}</p>
          ) : null}
          {zoneWarning ? <p style={helperTextStyle}>{zoneWarning}</p> : null}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>최근 활동</h2>
            <p style={helperTextStyle}>최대 20건</p>
          </div>
          <div style={listCardStyle}>
            {isAuthLoading || activityState === "loading" || activityState === "idle" ? (
              <ActivitySkeleton />
            ) : activityState === "error" ? (
              <div style={{ ...activityRowStyle, padding: "16px" }}>
                <p style={helperTextStyle}>{activityError}</p>
              </div>
            ) : activities.length === 0 ? (
              <div style={{ ...activityRowStyle, padding: "16px" }}>
                <p style={helperTextStyle}>최근 활동이 없어요.</p>
              </div>
            ) : (
              activities.map((activity, index) => {
                const type = getActivityType(activity);
                const typeLabel = ACTIVITY_LABELS[type];
                const timeLabel = formatTimestamp(activity.created_at);
                const actorLabel = getActorLabel(activity);
                const deltaLabel = formatDelta(activity.delta);
                const currentStock = stockByProductId.get(activity.product_id);
                const stockLabel =
                  currentStock === undefined
                    ? "현재 -"
                    : `현재 ${formatNumber(currentStock)}`;
                const deltaColor =
                  activity.delta > 0
                    ? "#2F6F46"
                    : activity.delta < 0
                      ? "#9B2C2C"
                      : "#5A514B";
                const isLast = index === activities.length - 1;

                return (
                  <div
                    key={activity.id}
                    style={{
                      ...activityRowStyle,
                      borderLeftColor: TYPE_BORDER_COLORS[type],
                      borderBottom: isLast ? "none" : "1px solid #EFEAE3",
                    }}
                  >
                    <div style={activityTopRowStyle}>
                      <span style={TYPE_BADGE_STYLES[type]}>{typeLabel}</span>
                      <p style={activityTitleStyle}>{activity.product_name}</p>
                      <div style={activityValueWrapStyle}>
                        <p style={{ ...activityDeltaStyle, color: deltaColor }}>
                          {deltaLabel}
                        </p>
                        <p style={activityStockStyle}>{stockLabel}</p>
                      </div>
                    </div>
                    <p style={activityMetaStyle}>
                      {actorLabel} · {timeLabel}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
      <style jsx global>{`
        .dashboard-pressable {
          transition: background-color 160ms ease, transform 160ms ease;
          -webkit-tap-highlight-color: transparent;
        }

        .dashboard-pressable:hover {
          background-color: rgba(46, 42, 39, 0.04);
        }

        .dashboard-pressable:active {
          background-color: rgba(46, 42, 39, 0.08);
          transform: translateY(1px);
        }

        @media (hover: none) {
          .dashboard-pressable:hover {
            background-color: transparent;
          }
        }
      `}</style>
    </div>
  );
}
