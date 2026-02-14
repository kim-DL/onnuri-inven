"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import DelayedRender from "@/app/_components/DelayedRender";
import cameraIcon from "@/asset/camera.png";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import {
  buildProductPhotoPath,
  PRODUCT_PHOTO_BUCKET,
  PRODUCT_PHOTO_UPLOAD_CACHE_CONTROL,
} from "@/lib/productPhoto";
import { resizeImageForUpload } from "@/lib/resizeImageForUpload";
import { supabase } from "@/lib/supabaseClient";
import { invalidateProductsListDataCache } from "@/lib/useProductsListData";

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
  initialQty: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F9F8F6",
  padding: "8px",
};

const containerStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  lineHeight: 1.2,
  margin: 0,
};

const helperTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#5A514B",
  margin: 0,
};

const cardStyle: CSSProperties = {
  padding: "9px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const formCardStyle: CSSProperties = {
  ...cardStyle,
  gap: "9px",
};

const photoSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const photoButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "58px",
  borderRadius: "12px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  appearance: "none",
  display: "flex",
  alignItems: "center",
  gap: "9px",
  padding: "7px 9px",
  cursor: "pointer",
  textAlign: "left",
};

const photoButtonDisabledStyle: CSSProperties = {
  opacity: 0.7,
  cursor: "default",
};

const photoThumbStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  border: "1px solid #DDD6CE",
  background: "#F1EDE7",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const photoImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const photoCameraIconStyle: CSSProperties = {
  width: "20px",
  height: "20px",
  objectFit: "contain",
};

const photoTextGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  flex: 1,
  minWidth: 0,
};

const photoPrimaryTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#2E2A27",
  fontWeight: 700,
  margin: 0,
};

const photoSecondaryTextStyle: CSSProperties = {
  fontSize: "12px",
  color: "#554E48",
  margin: 0,
};

const photoActionIconStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  borderRadius: "999px",
  border: "1px solid #DDD6CE",
  background: "#F8F4EE",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "16px",
  color: "#6C645F",
};

const formSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
};

const sectionDividerStyle: CSSProperties = {
  borderTop: "1px solid #EFEAE3",
  margin: "0",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const labelStyle: CSSProperties = {
  fontSize: "12px",
  color: "#2E2A27",
  margin: 0,
  fontWeight: 600,
};

const requiredMarkStyle: CSSProperties = {
  color: "#C81E1E",
  marginLeft: "2px",
};

const inputStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 10px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  fontSize: "14px",
  background: "#FFFFFF",
};

const inputErrorStyle: CSSProperties = {
  border: "1px solid #D14343",
  background: "#FFF7F7",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
};

const fieldErrorTextStyle: CSSProperties = {
  fontSize: "12px",
  color: "#B42318",
  margin: 0,
};

const gridFieldStyle: CSSProperties = {
  ...fieldStyle,
  minWidth: 0,
};

const optionalGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "7px",
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

const stickyBarStyle: CSSProperties = {
  position: "sticky",
  bottom: "0",
  background: "#F9F8F6",
  padding: "6px 0 8px",
  borderTop: "1px solid #E3DED8",
};

const stickyButtonStyle: CSSProperties = {
  ...buttonStyle,
  width: "100%",
};

const errorCardStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #F2C2C2",
  background: "#FFF3F2",
};

const errorTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#B42318",
  margin: 0,
  fontWeight: 600,
};

const skeletonBlockStyle: CSSProperties = {
  background: "#E7E3DD",
  borderRadius: "10px",
};

function SkeletonForm() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ ...skeletonBlockStyle, height: "28px", width: "38%" }} />
      <div style={{ ...skeletonBlockStyle, height: "56px", width: "100%" }} />
      <div style={{ ...cardStyle, border: "none" }}>
        <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
        <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
      </div>
      <div style={{ ...cardStyle, border: "none" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "6px",
          }}
        >
          <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
          <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
          <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
          <div style={{ ...skeletonBlockStyle, height: "44px", width: "100%" }} />
          <div
            style={{
              ...skeletonBlockStyle,
              height: "44px",
              width: "100%",
              gridColumn: "1 / -1",
            }}
          />
        </div>
      </div>
      <div style={{ ...cardStyle, border: "none" }}>
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
  initialQty: "",
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const updateField = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoPick = () => {
    if (isSubmitting) {
      return;
    }
    setPhotoError(null);
    photoInputRef.current?.click();
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoError("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoPreviewUrl(nextUrl);
    setPhotoError(null);
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
    if (qtyRaw === "") {
      errors.initialQty = "초기 수량을 입력해 주세요.";
    } else if (!/^\d+$/.test(qtyRaw)) {
      errors.initialQty = "초기 수량은 1 이상의 정수로 입력해 주세요.";
    } else {
      initialQty = Number(qtyRaw);
      if (initialQty < 1) {
        errors.initialQty = "초기 수량은 1 이상이어야 해요.";
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitError(null);
    setSubmitWarning(null);
    setIsSubmitting(true);
    const warnings: string[] = [];

    const payload = {
      name: trimmedName,
      zone_id: formState.zoneId,
      manufacturer: normalizeOptional(formState.manufacturer),
      unit: normalizeOptional(formState.unit),
      spec: normalizeOptional(formState.spec),
      origin_country: normalizeOptional(formState.originCountry),
      expiry_date: normalizeOptional(formState.expiryDate),
      active: true,
    };

    const { data: createdProductId, error: createProductError } = await supabase
      .rpc("create_product_with_inventory", {
        p_name: payload.name,
        p_zone_id: payload.zone_id,
        p_manufacturer: payload.manufacturer,
        p_unit: payload.unit,
        p_spec: payload.spec,
        p_origin_country: payload.origin_country,
        p_expiry_date: payload.expiry_date,
        p_initial_qty: initialQty,
      });

    if (createProductError || typeof createdProductId !== "string") {
      console.error("Failed to create product", createProductError);
      setSubmitError("저장에 실패했어요.");
      setIsSubmitting(false);
      return;
    }

    const productId = createdProductId;

    if (photoFile) {
      const uploadFile = await resizeImageForUpload(photoFile);
      const photoPath = buildProductPhotoPath(productId, uploadFile);
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_PHOTO_BUCKET)
        .upload(photoPath, uploadFile, {
          upsert: false,
          cacheControl: PRODUCT_PHOTO_UPLOAD_CACHE_CONTROL,
        });

      if (uploadError) {
        console.error("Failed to upload product photo", {
          message: uploadError?.message,

        });
        warnings.push("제품은 저장됐지만 사진 업로드에 실패했어요.");
      } else {
        const { error: updateError } = await supabase
          .from("products")
          .update({ photo_url: photoPath })
          .eq("id", productId);

        if (updateError) {
          console.error("Failed to update product photo", {
            message: updateError?.message,
            details: updateError?.details,
            hint: updateError?.hint,
            code: updateError?.code,
          });
          warnings.push("제품은 저장됐지만 사진 연결에 실패했어요.");
          const { error: cleanupError } = await supabase.storage
            .from(PRODUCT_PHOTO_BUCKET)
            .remove([photoPath]);
          if (cleanupError) {
            console.error("Failed to clean up product photo", {
              message: cleanupError?.message,

            });
          }
        }
      }
    }

    setIsSubmitting(false);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoError(null);
    setSubmitWarning(warnings.length > 0 ? warnings.join(" ") : null);
    invalidateProductsListDataCache();
    setIsSuccess(true);
  };

  const handleReset = () => {
    setFormState(defaultForm);
    setFormErrors({});
    setSubmitError(null);
    setSubmitWarning(null);
    setIsSuccess(false);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoError(null);
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
          <DelayedRender active={isLoading} ms={150}>
            <SkeletonForm />
          </DelayedRender>
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
              <Link
                href="/products"
                className="productsBackLink"
                aria-label="제품 목록으로 돌아가기"
              >
                돌아가기
              </Link>
              <h1 style={titleStyle}>상품 등록</h1>
            </header>

            <form
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                paddingBottom: "48px",
              }}
              onSubmit={handleSubmit}
            >
              <div style={photoSectionStyle}>
                <button
                  type="button"
                  style={
                    isSubmitting
                      ? { ...photoButtonStyle, ...photoButtonDisabledStyle }
                      : photoButtonStyle
                  }
                  aria-label={photoPreviewUrl ? "사진 재촬영" : "사진 촬영"}
                  onClick={handlePhotoPick}
                  disabled={isSubmitting}
                >
                  <span style={photoThumbStyle}>
                    {photoPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoPreviewUrl}
                        alt="선택된 사진"
                        style={photoImageStyle}
                      />
                    ) : (
                      <Image
                        src={cameraIcon}
                        alt=""
                        width={20}
                        height={20}
                        aria-hidden="true"
                        style={photoCameraIconStyle}
                      />
                    )}
                  </span>
                  <span style={photoTextGroupStyle}>
                    <span style={photoPrimaryTextStyle}>
                      {photoPreviewUrl ? "사진 재촬영" : "사진 촬영"}
                    </span>
                    <span style={photoSecondaryTextStyle}>
                      {photoPreviewUrl ? "사진 등록됨" : "탭해서 카메라 열기"}
                    </span>
                  </span>
                  <span style={photoActionIconStyle} aria-hidden="true">
                    ›
                  </span>
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />
                {photoError ? <p style={errorTextStyle}>{photoError}</p> : null}
              </div>

              <div style={formCardStyle}>
                <div style={formSectionStyle}>
                  <div style={fieldStyle}>
                    <label htmlFor="product-name" style={labelStyle}>
                      제품명
                      <span style={requiredMarkStyle} aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      id="product-name"
                      type="text"
                      value={formState.name}
                      onChange={(event) => updateField("name", event.currentTarget.value)}
                      placeholder="제품명을 입력해 주세요"
                      style={formErrors.name ? { ...inputStyle, ...inputErrorStyle } : inputStyle}
                    />
                    {formErrors.name ? (
                      <p style={fieldErrorTextStyle}>{formErrors.name}</p>
                    ) : null}
                  </div>

                  <div style={fieldStyle}>
                    <label htmlFor="product-zone" style={labelStyle}>
                      구역
                      <span style={requiredMarkStyle} aria-hidden="true">
                        *
                      </span>
                    </label>
                    <select
                      id="product-zone"
                      value={formState.zoneId}
                      onChange={(event) => updateField("zoneId", event.currentTarget.value)}
                      style={
                        formErrors.zoneId ? { ...selectStyle, ...inputErrorStyle } : selectStyle
                      }
                    >
                      <option value="">
                        {hasZones ? "구역을 선택해 주세요" : "구역 정보 없음"}
                      </option>
                      {zoneOptions}
                    </select>
                    {formErrors.zoneId ? (
                      <p style={fieldErrorTextStyle}>{formErrors.zoneId}</p>
                    ) : null}
                  </div>
                </div>

                <div style={sectionDividerStyle} />

                <div style={optionalGridStyle}>
                  <div style={gridFieldStyle}>
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

                  <div style={gridFieldStyle}>
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

                  <div style={gridFieldStyle}>
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

                  <div style={gridFieldStyle}>
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

                  <div style={{ ...gridFieldStyle, gridColumn: "1 / -1" }}>
                    <label htmlFor="product-expiry" style={labelStyle}>
                      유통기한
                    </label>
                    <input
                      id="product-expiry"
                      type="date"
                      value={formState.expiryDate}
                      onChange={(event) => updateField("expiryDate", event.currentTarget.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={sectionDividerStyle} />

                <div style={fieldStyle}>
                  <label htmlFor="product-initial" style={labelStyle}>
                    초기 수량
                    <span style={requiredMarkStyle} aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="product-initial"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formState.initialQty}
                    onChange={(event) => updateField("initialQty", event.currentTarget.value)}
                    placeholder="1 이상"
                    style={
                      formErrors.initialQty ? { ...inputStyle, ...inputErrorStyle } : inputStyle
                    }
                  />
                  {formErrors.initialQty ? (
                    <p style={fieldErrorTextStyle}>{formErrors.initialQty}</p>
                  ) : null}
                </div>
              </div>

              {submitError ? (
                <div style={errorCardStyle}>
                  <p style={errorTextStyle}>{submitError}</p>
                </div>
              ) : null}

              <div style={stickyBarStyle}>
                <button
                  type="submit"
                  style={stickyButtonStyle}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "저장 중..." : "저장하기"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
