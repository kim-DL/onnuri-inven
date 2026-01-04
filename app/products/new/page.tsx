"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type Zone = {
  id: string;
  name: string;
};

type AuthState = "checking" | "authed" | "blocked" | "error";
type DataState = "idle" | "loading" | "ready" | "error";

type FormState = {
  name: string;
  zoneId: string;
  manufacturer: string;
  unit: string;
  spec: string;
  originCountry: string;
  expiryDate: string;
  photoUrl: string;
  initialQty: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

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
  gap: "6px",
};

const titleStyle: CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  margin: 0,
};

const helperTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#5A514B",
  margin: 0,
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

const sectionTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
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

const selectStyle: CSSProperties = {
  ...inputStyle,
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

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const skeletonBlockStyle: CSSProperties = {
  background: "#E7E3DD",
  borderRadius: "10px",
};

function SkeletonForm() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ ...skeletonBlockStyle, height: "28px", width: "40%" }} />
      <div style={{ ...cardStyle, border: "none" }}>
        <div style={{ ...skeletonBlockStyle, height: "14px", width: "30%" }} />
        <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
        <div style={{ ...skeletonBlockStyle, height: "14px", width: "30%" }} />
        <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
      </div>
      <div style={{ ...cardStyle, border: "none" }}>
        <div style={{ ...skeletonBlockStyle, height: "14px", width: "30%" }} />
        <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
      </div>
    </div>
  );
}

const defaultForm: FormState = {
  name: "",
  zoneId: "",
  manufacturer: "",
  unit: "",
  spec: "",
  originCountry: "",
  expiryDate: "",
  photoUrl: "",
  initialQty: "0",
};

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function NewProductPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [dataState, setDataState] = useState<DataState>("idle");
  const [zones, setZones] = useState<Zone[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(defaultForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

    const loadZones = async () => {
      setDataState("loading");
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("zones")
        .select("id, name")
        .eq("active", true)
        .order("sort_order");

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Failed to fetch zones", error);
        setErrorMessage("구역 정보를 불러오지 못했어요.");
        setDataState("error");
        return;
      }

      setZones(data ?? []);
      setDataState("ready");
    };

    loadZones();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  const isLoading =
    authState === "checking" ||
    (authState === "authed" && (dataState === "idle" || dataState === "loading"));

  const hasError =
    authState === "error" || (authState === "authed" && dataState === "error");

  const hasZones = zones.length > 0;

  const zoneOptions = useMemo(
    () =>
      zones.map((zone) => (
        <option key={zone.id} value={zone.id}>
          {zone.name}
        </option>
      )),
    [zones]
  );

  const updateField = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedName = formState.name.trim();
    const errors: FormErrors = {};
    if (!trimmedName) {
      errors.name = "제품명을 입력해 주세요.";
    }
    if (!formState.zoneId) {
      errors.zoneId = "구역을 선택해 주세요.";
    }

    let initialQty = 0;
    const qtyRaw = formState.initialQty.trim();
    if (qtyRaw !== "") {
      if (!/^\d+$/.test(qtyRaw)) {
        errors.initialQty = "수량은 0 이상의 정수로 입력해 주세요.";
      } else {
        initialQty = Number(qtyRaw);
      }
    }
    if (initialQty < 0) {
      errors.initialQty = "수량은 0 이상의 정수로 입력해 주세요.";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitError(null);
    setSubmitWarning(null);
    setIsSubmitting(true);

    const payload = {
      name: trimmedName,
      zone_id: formState.zoneId,
      manufacturer: normalizeOptional(formState.manufacturer),
      unit: normalizeOptional(formState.unit),
      spec: normalizeOptional(formState.spec),
      origin_country: normalizeOptional(formState.originCountry),
      expiry_date: normalizeOptional(formState.expiryDate),
      photo_url: normalizeOptional(formState.photoUrl),
      active: true,
    };

    const { data: productData, error: productError } = await supabase
      .from("products")
      .insert(payload)
      .select("id")
      .single();

    if (productError || !productData) {
      console.error("Failed to create product", productError);
      setSubmitError("저장에 실패했어요.");
      setIsSubmitting(false);
      return;
    }

    const { error: inventoryError } = await supabase
      .from("inventory")
      .insert({ product_id: productData.id, stock: 0 });

    if (inventoryError) {
      console.error("Failed to create inventory", inventoryError);
      setSubmitError("저장에 실패했어요.");
      setIsSubmitting(false);
      return;
    }

    if (initialQty > 0) {
      const { error: adjustError } = await supabase.rpc("adjust_stock", {
        p_product_id: productData.id,
        p_delta: initialQty,
        p_note: null,
      });

      if (adjustError) {
        console.error("Failed to adjust stock", adjustError);
        setSubmitWarning("상품은 저장됐지만 초기 재고 등록에 실패했어요.");
      }
    }

    setIsSubmitting(false);
    setIsSuccess(true);
  };

  const handleReset = () => {
    setFormState(defaultForm);
    setFormErrors({});
    setSubmitError(null);
    setSubmitWarning(null);
    setIsSuccess(false);
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
          <SkeletonForm />
        ) : hasError ? (
          <div style={cardStyle}>
            <p style={helperTextStyle}>
              {errorMessage ?? "화면을 불러오지 못했어요."}
            </p>
          </div>
        ) : isSuccess ? (
          <div style={cardStyle}>
            <h1 style={sectionTitleStyle}>저장 완료</h1>
            <p style={helperTextStyle}>상품이 등록되었어요.</p>
            {submitWarning ? (
              <p style={helperTextStyle}>{submitWarning}</p>
            ) : null}
            <div style={buttonRowStyle}>
              <button type="button" style={secondaryButtonStyle} onClick={handleReset}>
                추가 등록하기
              </button>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => router.replace("/products")}
              >
                목록으로
              </button>
            </div>
          </div>
        ) : (
          <>
            <header style={headerStyle}>
              <h1 style={titleStyle}>상품 등록</h1>
              <p style={helperTextStyle}>
                필수 항목만 입력해도 저장할 수 있어요.
              </p>
            </header>

            <form style={{ display: "flex", flexDirection: "column", gap: "16px" }} onSubmit={handleSubmit}>
              <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>기본 정보</h2>
                <div style={fieldStyle}>
                  <label htmlFor="product-name" style={labelStyle}>
                    제품명
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    value={formState.name}
                    onChange={(event) => updateField("name", event.currentTarget.value)}
                    placeholder="제품명을 입력해 주세요"
                    style={inputStyle}
                  />
                  {formErrors.name ? (
                    <p style={helperTextStyle}>{formErrors.name}</p>
                  ) : null}
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="product-zone" style={labelStyle}>
                    구역
                  </label>
                  <select
                    id="product-zone"
                    value={formState.zoneId}
                    onChange={(event) => updateField("zoneId", event.currentTarget.value)}
                    style={selectStyle}
                  >
                    <option value="">
                      {hasZones ? "구역을 선택해 주세요" : "구역 정보 없음"}
                    </option>
                    {zoneOptions}
                  </select>
                  {formErrors.zoneId ? (
                    <p style={helperTextStyle}>{formErrors.zoneId}</p>
                  ) : null}
                </div>
              </div>

              <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>추가 정보</h2>
                <div style={fieldStyle}>
                  <label htmlFor="product-manufacturer" style={labelStyle}>
                    제조사
                  </label>
                  <input
                    id="product-manufacturer"
                    type="text"
                    value={formState.manufacturer}
                    onChange={(event) =>
                      updateField("manufacturer", event.currentTarget.value)
                    }
                    placeholder="제조사"
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="product-unit" style={labelStyle}>
                    단위
                  </label>
                  <input
                    id="product-unit"
                    type="text"
                    value={formState.unit}
                    onChange={(event) => updateField("unit", event.currentTarget.value)}
                    placeholder="단위"
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="product-spec" style={labelStyle}>
                    규격
                  </label>
                  <input
                    id="product-spec"
                    type="text"
                    value={formState.spec}
                    onChange={(event) => updateField("spec", event.currentTarget.value)}
                    placeholder="규격"
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="product-origin" style={labelStyle}>
                    원산지
                  </label>
                  <input
                    id="product-origin"
                    type="text"
                    value={formState.originCountry}
                    onChange={(event) =>
                      updateField("originCountry", event.currentTarget.value)
                    }
                    placeholder="원산지"
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="product-expiry" style={labelStyle}>
                    유통기한
                  </label>
                  <input
                    id="product-expiry"
                    type="date"
                    value={formState.expiryDate}
                    onChange={(event) =>
                      updateField("expiryDate", event.currentTarget.value)
                    }
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="product-photo" style={labelStyle}>
                    사진 URL
                  </label>
                  <input
                    id="product-photo"
                    type="url"
                    value={formState.photoUrl}
                    onChange={(event) => updateField("photoUrl", event.currentTarget.value)}
                    placeholder="사진 URL"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>초기 재고</h2>
                <div style={fieldStyle}>
                  <label htmlFor="product-initial" style={labelStyle}>
                    초기 수량
                  </label>
                  <input
                    id="product-initial"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formState.initialQty}
                    onChange={(event) =>
                      updateField("initialQty", event.currentTarget.value)
                    }
                    placeholder="0"
                    style={inputStyle}
                  />
                  {formErrors.initialQty ? (
                    <p style={helperTextStyle}>{formErrors.initialQty}</p>
                  ) : null}
                </div>
              </div>

              {submitError ? (
                <div style={cardStyle}>
                  <p style={helperTextStyle}>{submitError}</p>
                </div>
              ) : null}

              <button type="submit" style={buttonStyle} disabled={isSubmitting}>
                {isSubmitting ? "저장 중..." : "저장하기"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
