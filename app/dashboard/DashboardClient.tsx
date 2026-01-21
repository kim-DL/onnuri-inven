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
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const titleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const cardStyle: CSSProperties = {
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
};

const helperTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#5A514B",
  margin: 0,
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
};

const summaryLabelStyle: CSSProperties = {
  fontSize: "12px",
  color: "#7B736C",
  margin: 0,
};

const summaryValueStyle: CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  margin: 0,
  color: "#2E2A27",
};

const buttonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #2E2A27",
  background: "#2E2A27",
  color: "#FFFFFF",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
};

const statusBadgeBaseStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
};

const statusBadgePositiveStyle: CSSProperties = {
  ...statusBadgeBaseStyle,
  background: "#ECFDF3",
  borderColor: "#ABEFC6",
  color: "#067647",
};

const statusBadgeNeutralStyle: CSSProperties = {
  ...statusBadgeBaseStyle,
  background: "#F2F4F7",
  borderColor: "#D0D5DD",
  color: "#475467",
};

const statusBadgeErrorStyle: CSSProperties = {
  ...statusBadgeBaseStyle,
  background: "#FEE4E2",
  borderColor: "#FECDCA",
  color: "#B42318",
};

const zoneListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const zoneRowStyle: CSSProperties = {
  minHeight: "44px",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #E8E2DB",
  background: "#FFFFFF",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  textDecoration: "none",
  color: "#2E2A27",
};

const zoneNameStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  margin: 0,
};

const zoneCountStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
};

const activityListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const activityRowStyle: CSSProperties = {
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #E3DED8",
  borderLeftWidth: "4px",
  borderLeftStyle: "solid",
  background: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const activityHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const activityTitleStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  margin: 0,
  color: "#2E2A27",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const activityMetaStyle: CSSProperties = {
  fontSize: "12px",
  color: "#7B736C",
  margin: 0,
};

const typeBadgeBaseStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "2px 6px",
  borderRadius: "999px",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
};

const TYPE_BADGE_STYLES: Record<ActivityType, CSSProperties> = {
  IN: {
    ...typeBadgeBaseStyle,
    background: "#ECFDF3",
    borderColor: "#ABEFC6",
    color: "#067647",
  },
  OUT: {
    ...typeBadgeBaseStyle,
    background: "#FEE4E2",
    borderColor: "#FECDCA",
    color: "#B42318",
  },
  ADJUST: {
    ...typeBadgeBaseStyle,
    background: "#F2F4F7",
    borderColor: "#D0D5DD",
    color: "#475467",
  },
};

const TYPE_BORDER_COLORS: Record<ActivityType, string> = {
  IN: "#16A34A",
  OUT: "#DC2626",
  ADJUST: "#64748B",
};

const skeletonBlockStyle: CSSProperties = {
  background: "#E7E3DD",
  borderRadius: "10px",
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function SummarySkeleton() {
  return (
    <div style={summaryGridStyle}>
      {[0, 1, 2].map((item) => (
        <div key={item} style={{ ...cardStyle, border: "none" }}>
          <div style={{ ...skeletonBlockStyle, height: "12px", width: "50%" }} />
          <div style={{ ...skeletonBlockStyle, height: "24px", width: "60%" }} />
        </div>
      ))}
    </div>
  );
}

function ZoneSkeleton() {
  return (
    <div style={zoneListStyle}>
      {[0, 1, 2].map((item) => (
        <div key={item} style={{ ...zoneRowStyle, border: "none" }}>
          <div style={{ ...skeletonBlockStyle, height: "14px", width: "40%" }} />
          <div style={{ ...skeletonBlockStyle, height: "16px", width: "20%" }} />
        </div>
      ))}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div style={activityListStyle}>
      {[0, 1, 2].map((item) => (
        <div key={item} style={{ ...activityRowStyle, border: "none" }}>
          <div style={{ ...skeletonBlockStyle, height: "14px", width: "55%" }} />
          <div style={{ ...skeletonBlockStyle, height: "12px", width: "35%" }} />
        </div>
      ))}
    </div>
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
        setTotalError("총 제품 수를 불러오지 못했어요.");
        setTotalState("error");
      } else {
        setTotalCount(totalResult.count ?? 0);
        setTotalState("ready");
      }

      if (activityResult.error) {
        console.error("Failed to fetch recent activity", activityResult.error);
        setActivityError("최근 활동을 불러오지 못했어요.");
        setActivityState("error");
      } else {
        setActivities(
          (activityResult.data as RecentActivityRow[] | null | undefined) ?? []
        );
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
        return;
      }

      const zonesData = (zonesResult.data as Zone[] | null | undefined) ?? [];
      if (zonesData.length === 0) {
        setZoneCounts([]);
        setZoneState("ready");
        return;
      }

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

  const totalLabel = totalState === "ready" ? totalCount ?? 0 : null;
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
          <div style={{ ...cardStyle, gap: "12px" }}>
            <p style={helperTextStyle}>
              계정이 비활성화되어 있어 접근할 수 없어요.
            </p>
            <button type="button" style={buttonStyle} onClick={handleLogout}>
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
        <header style={headerStyle}>
          <h1 style={titleStyle}>대시보드</h1>
        </header>
        {signOutError ? <p style={helperTextStyle}>{signOutError}</p> : null}

        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 style={sectionTitleStyle}>요약</h2>
          {isAuthLoading ? (
            <SummarySkeleton />
          ) : (
            <div style={summaryGridStyle}>
              <div style={cardStyle}>
                <p style={summaryLabelStyle}>총 제품 수(활성)</p>
                {totalState === "loading" || totalState === "idle" ? (
                  <div style={{ ...skeletonBlockStyle, height: "24px", width: "60%" }} />
                ) : totalState === "error" ? (
                  <p style={helperTextStyle}>{totalError}</p>
                ) : (
                  <p style={summaryValueStyle}>
                    {(totalLabel ?? 0).toLocaleString("ko-KR")}
                  </p>
                )}
              </div>
              <div style={cardStyle}>
                <p style={summaryLabelStyle}>기준일: {fridayLabel} (금)</p>
                <span style={adjustBadge.style}>{adjustBadge.text}</span>
                {fridayState === "error" && fridayError ? (
                  <p style={helperTextStyle}>{fridayError}</p>
                ) : null}
              </div>
              <div style={cardStyle}>
                <p style={summaryLabelStyle}>빠른 이동</p>
                <Link href="/products" style={buttonStyle}>
                  제품목록으로 이동
                </Link>
              </div>
            </div>
          )}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 style={sectionTitleStyle}>구역별 제품 수</h2>
          {isAuthLoading || zoneState === "loading" || zoneState === "idle" ? (
            <ZoneSkeleton />
          ) : zoneState === "error" ? (
            <div style={cardStyle}>
              <p style={helperTextStyle}>{zoneError}</p>
            </div>
          ) : zoneCounts.length === 0 ? (
            <div style={cardStyle}>
              <p style={helperTextStyle}>구역 정보가 없어요.</p>
            </div>
          ) : (
            <div style={zoneListStyle}>
              {zoneCounts.map((row) => {
                const href = `/products?zone=${encodeURIComponent(row.zone.name)}`;
                const countLabel =
                  row.count === null ? "-" : row.count.toLocaleString("ko-KR");
                return (
                  <Link key={row.zone.id} href={href} style={zoneRowStyle}>
                    <p style={zoneNameStyle}>{row.zone.name}</p>
                    <p style={zoneCountStyle}>{countLabel}</p>
                  </Link>
                );
              })}
            </div>
          )}
          {zoneWarning ? <p style={helperTextStyle}>{zoneWarning}</p> : null}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 style={sectionTitleStyle}>최근 활동</h2>
          {isAuthLoading || activityState === "loading" || activityState === "idle" ? (
            <ActivitySkeleton />
          ) : activityState === "error" ? (
            <div style={cardStyle}>
              <p style={helperTextStyle}>{activityError}</p>
            </div>
          ) : activities.length === 0 ? (
            <div style={cardStyle}>
              <p style={helperTextStyle}>최근 활동이 없어요.</p>
            </div>
          ) : (
            <div style={activityListStyle}>
              {activities.map((activity) => {
                const type = getActivityType(activity);
                const timeLabel = formatTimestamp(activity.created_at);
                const actorLabel = getActorLabel(activity);
                return (
                  <div
                    key={activity.id}
                    style={{
                      ...activityRowStyle,
                      borderLeftColor: TYPE_BORDER_COLORS[type],
                    }}
                  >
                    <div style={activityHeaderStyle}>
                      <span style={TYPE_BADGE_STYLES[type]}>{type}</span>
                      <p style={activityTitleStyle}>
                        <strong>{activity.product_name}</strong>
                      </p>
                    </div>
                    <p style={activityMetaStyle}>
                      {actorLabel} · {timeLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

