"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ko } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import type { Formatters, Styles } from "react-day-picker";
import "react-day-picker/dist/style.css";
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
  minHeight: "100dvh",
  background: "#F9F8F6",
  padding: "10px 8px 8px",
  boxSizing: "border-box",
};

const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: "720px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: 1.2,
  margin: 0,
};

const helperTextStyle: CSSProperties = {
  fontSize: "15px",
  color: "#5A514B",
  margin: 0,
};

const cardStyle: CSSProperties = {
  padding: "11px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const formCardStyle: CSSProperties = {
  ...cardStyle,
  gap: "10px",
};

const photoSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const photoButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "70px",
  borderRadius: "12px",
  border: "1px solid #CCC3B9",
  background: "#FCFBF9",
  appearance: "none",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 12px",
  cursor: "pointer",
  textAlign: "left",
  boxShadow: "0 2px 10px rgba(40, 33, 29, 0.05)",
};

const photoButtonDisabledStyle: CSSProperties = {
  opacity: 0.7,
  cursor: "default",
};

const photoThumbStyle: CSSProperties = {
  width: "46px",
  height: "46px",
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
  width: "22px",
  height: "22px",
  objectFit: "contain",
};

const photoTextGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  flex: 1,
  minWidth: 0,
};

const photoPrimaryTextStyle: CSSProperties = {
  fontSize: "16.5px",
  color: "#2E2A27",
  fontWeight: 700,
  margin: 0,
};

const photoSecondaryTextStyle: CSSProperties = {
  fontSize: "14.5px",
  color: "#554E48",
  margin: 0,
};

const photoActionIconStyle: CSSProperties = {
  width: "26px",
  height: "26px",
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
  gap: "8px",
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

const sectionDividerSpaciousStyle: CSSProperties = {
  ...sectionDividerStyle,
  margin: "5px 0 7px",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const labelStyle: CSSProperties = {
  fontSize: "14px",
  color: "#2E2A27",
  margin: 0,
  fontWeight: 600,
};

const requiredMarkStyle: CSSProperties = {
  color: "#C81E1E",
  marginLeft: "2px",
};

const inputStyle: CSSProperties = {
  minHeight: "48px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  fontSize: "16px",
  background: "#FFFFFF",
  width: "100%",
  boxSizing: "border-box",
};

const inputErrorStyle: CSSProperties = {
  border: "1px solid #D14343",
  background: "#FFF7F7",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
};

const fieldErrorTextStyle: CSSProperties = {
  fontSize: "13.5px",
  color: "#B42318",
  margin: 0,
};

const dateInputRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const dateInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const dateToggleButtonStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "8px",
  border: "1px solid #D6D2CC",
  background: "#F8F4EE",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
};

const dateToggleButtonActiveStyle: CSSProperties = {
  background: "#EFE9E2",
  border: "1px solid #CFC8C1",
};

const calendarIconStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  color: "#3F3935",
};

const calendarPopoverStyle: CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 8px)",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 40,
  border: "1px solid #E3DED8",
  borderRadius: "12px",
  background: "#FFFFFF",
  boxShadow: "0 10px 30px rgba(30, 24, 20, 0.12)",
  padding: "10px",
  width: "max-content",
  maxWidth: "min(92vw, 340px)",
};

const dayPickerStyles: Partial<Styles> = {
  month_caption: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "8px",
  },
  dropdowns: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  dropdown_root: {
    position: "relative",
  },
  dropdown: {
    height: "34px",
    borderRadius: "8px",
    border: "1px solid #D6D2CC",
    background: "#FFFFFF",
    color: "#2E2A27",
    padding: "0 24px 0 8px",
    fontSize: "14px",
    fontWeight: 600,
  },
  months_dropdown: {
    minWidth: "74px",
  },
  years_dropdown: {
    minWidth: "92px",
  },
  chevron: {
    width: "14px",
    height: "14px",
    color: "#5A514B",
  },
  weekday: {
    fontSize: "13.5px",
    fontWeight: 600,
    color: "#6C645F",
    textAlign: "center",
    width: "34px",
    height: "24px",
  },
  day_button: {
    width: "36px",
    height: "36px",
    fontSize: "14.5px",
    borderRadius: "10px",
    color: "#2E2A27",
  },
  selected: {
    background: "#2E2A27",
    color: "#FFFFFF",
    fontWeight: 700,
  },
  today: {
    border: "1px solid #A89D92",
  },
  button_previous: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
  },
  button_next: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
  },
};

const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const dayPickerFormatters: Partial<Formatters> = {
  formatCaption: (month: Date) => `${month.getFullYear()}년 ${month.getMonth() + 1}월`,
  formatWeekdayName: (weekday: Date) => KOREAN_WEEKDAYS[weekday.getDay()],
  formatMonthDropdown: (month: Date) => `${month.getMonth() + 1}월`,
  formatYearDropdown: (year: Date) => `${year.getFullYear()}년`,
};

const gridFieldStyle: CSSProperties = {
  ...fieldStyle,
  minWidth: 0,
};

const optionalGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "9px",
};

const buttonStyle: CSSProperties = {
  minHeight: "50px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "none",
  background: "#2E2A27",
  color: "#FFFFFF",
  fontSize: "17px",
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
  marginTop: "8px",
  paddingTop: "2px",
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

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDateToIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function normalizeDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
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
  const expiryFieldRef = useRef<HTMLDivElement | null>(null);
  const [isExpiryCalendarOpen, setIsExpiryCalendarOpen] = useState(false);
  const [expiryCalendarMonth, setExpiryCalendarMonth] = useState(() => new Date());

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

  const selectedExpiryDate = useMemo(
    () => parseIsoDate(formState.expiryDate),
    [formState.expiryDate]
  );

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (!isExpiryCalendarOpen) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (expiryFieldRef.current?.contains(target)) {
        return;
      }

      setIsExpiryCalendarOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [isExpiryCalendarOpen]);

  const updateField = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const clearFieldError = (field: keyof FormState) => {
    setFormErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }

      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleExpiryDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeDateInput(event.currentTarget.value);
    updateField("expiryDate", normalized);
    clearFieldError("expiryDate");

    const parsed = parseIsoDate(normalized);
    if (parsed) {
      setExpiryCalendarMonth(parsed);
    }
  };

  const handleExpiryDateSelect = (date: Date | undefined) => {
    if (!date) {
      updateField("expiryDate", "");
      clearFieldError("expiryDate");
      setIsExpiryCalendarOpen(false);
      return;
    }

    updateField("expiryDate", formatDateToIso(date));
    clearFieldError("expiryDate");
    setExpiryCalendarMonth(date);
    setIsExpiryCalendarOpen(false);
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
    const trimmedExpiryDate = formState.expiryDate.trim();
    if (trimmedExpiryDate !== "" && !parseIsoDate(trimmedExpiryDate)) {
      errors.expiryDate = "유통기한은 YYYY-MM-DD 형식으로 입력해 주세요.";
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
      expiry_date: normalizeOptional(trimmedExpiryDate),
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
                gap: "10px",
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

                <div style={sectionDividerSpaciousStyle} />

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

                  <div
                    ref={expiryFieldRef}
                    style={{ ...gridFieldStyle, gridColumn: "1 / -1", position: "relative" }}
                  >
                    <label htmlFor="product-expiry" style={labelStyle}>
                      유통기한
                    </label>
                    <div style={dateInputRowStyle}>
                      <input
                        id="product-expiry"
                        type="text"
                        inputMode="numeric"
                        placeholder="YYYY-MM-DD"
                        value={formState.expiryDate}
                        onChange={handleExpiryDateChange}
                        style={
                          formErrors.expiryDate
                            ? { ...inputStyle, ...dateInputStyle, ...inputErrorStyle }
                            : { ...inputStyle, ...dateInputStyle }
                        }
                      />
                      <button
                        type="button"
                        aria-label="달력 열기"
                        aria-expanded={isExpiryCalendarOpen}
                        style={
                          isExpiryCalendarOpen
                            ? { ...dateToggleButtonStyle, ...dateToggleButtonActiveStyle }
                            : dateToggleButtonStyle
                        }
                        onClick={() => {
                          if (isExpiryCalendarOpen) {
                            setIsExpiryCalendarOpen(false);
                            return;
                          }

                          setExpiryCalendarMonth(selectedExpiryDate ?? new Date());
                          setIsExpiryCalendarOpen(true);
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={calendarIconStyle}
                          aria-hidden="true"
                        >
                          <path
                            d="M7 3V6M17 3V6M4 10H20M6 21H18C19.1 21 20 20.1 20 19V7C20 5.9 19.1 5 18 5H6C4.9 5 4 5.9 4 7V19C4 20.1 4.9 21 6 21Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                    {formErrors.expiryDate ? (
                      <p style={fieldErrorTextStyle}>{formErrors.expiryDate}</p>
                    ) : null}
                    {isExpiryCalendarOpen ? (
                      <div style={calendarPopoverStyle}>
                        <DayPicker
                          mode="single"
                          selected={selectedExpiryDate ?? undefined}
                          onSelect={handleExpiryDateSelect}
                          month={expiryCalendarMonth}
                          onMonthChange={setExpiryCalendarMonth}
                          locale={ko}
                          weekStartsOn={0}
                          captionLayout="dropdown"
                          startMonth={new Date(2015, 0)}
                          endMonth={new Date(2035, 11)}
                          reverseYears
                          navLayout="after"
                          formatters={dayPickerFormatters}
                          showOutsideDays
                          styles={dayPickerStyles}
                        />
                      </div>
                    ) : null}
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
