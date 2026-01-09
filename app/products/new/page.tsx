"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
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

const photoSlotStyle: CSSProperties = {
  width: "160px",
  height: "160px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#F1EDE7",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  alignSelf: "center",
};

const photoPlaceholderStyle: CSSProperties = {
  fontSize: "14px",
  color: "#8C847D",
  fontWeight: 600,
  textAlign: "center",
};

const photoImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const photoActionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const photoActionButtonStyle: CSSProperties = {
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

const photoRemoveButtonStyle: CSSProperties = {
  ...photoActionButtonStyle,
  color: "#B42318",
  border: "1px solid #E3DED8",
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
  initialQty: "0",
};

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;
const LARGE_IMAGE_BYTES = 10 * 1024 * 1024;

async function getExifOrientation(file: File): Promise<number> {
  if (!file.type.includes("jpeg") && !file.type.includes("jpg")) {
    return 1;
  }

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (view.getUint16(0, false) !== 0xffd8) {
    return 1;
  }

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    const size = view.getUint16(offset + 2, false);
    if (!size) {
      break;
    }
    if (marker === 0xffe1) {
      const exifStart = offset + 4;
      const exifHeader = view.getUint32(exifStart, false);
      if (exifHeader !== 0x45786966) {
        break;
      }
      const tiffOffset = exifStart + 6;
      const littleEndian = view.getUint16(tiffOffset, false) === 0x4949;
      const getUint16 = (pos: number) => view.getUint16(pos, littleEndian);
      const getUint32 = (pos: number) => view.getUint32(pos, littleEndian);
      const firstIfdOffset = getUint32(tiffOffset + 4);
      let ifdOffset = tiffOffset + firstIfdOffset;
      const entries = getUint16(ifdOffset);
      for (let i = 0; i < entries; i += 1) {
        const entryOffset = ifdOffset + 2 + i * 12;
        const tag = getUint16(entryOffset);
        if (tag === 0x0112) {
          return getUint16(entryOffset + 8);
        }
      }
      break;
    }
    offset += 2 + size;
  }

  return 1;
}

function applyOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number
) {
  switch (orientation) {
    case 2:
      ctx.setTransform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.setTransform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.setTransform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.setTransform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.setTransform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.setTransform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.setTransform(0, -1, 1, 0, 0, width);
      break;
    default:
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      break;
  }
}

function hasTransparency(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
}

async function loadImageForCanvas(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "none",
      });
      return { image: bitmap, cleanup: () => bitmap.close() };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return { image: bitmap, cleanup: () => bitmap.close() };
      } catch {
        // Fall through to HTMLImageElement.
      }
    }
  }

  const img = new Image();
  img.decoding = "async";
  img.style.setProperty("image-orientation", "none");
  img.style.setProperty("-webkit-image-orientation", "none");
  const objectUrl = URL.createObjectURL(file);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });

  return { image, cleanup: () => {} };
}

async function resizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (file.size > LARGE_IMAGE_BYTES) {
    console.warn("Large image file detected. Resizing anyway.", {
      name: file.name,
      size: file.size,
    });
  }

  let orientation = 1;
  try {
    orientation = await getExifOrientation(file);
  } catch (error) {
    console.warn("Failed to read EXIF orientation.", error);
  }

  let loaded: { image: ImageBitmap | HTMLImageElement; cleanup: () => void } | null =
    null;

  try {
    loaded = await loadImageForCanvas(file);
    const { image } = loaded;
    const sourceWidth =
      image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const sourceHeight =
      image instanceof HTMLImageElement ? image.naturalHeight : image.height;

    if (!sourceWidth || !sourceHeight) {
      return file;
    }

    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight)
    );
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const rotated = orientation >= 5 && orientation <= 8;

    const canvas = document.createElement("canvas");
    canvas.width = rotated ? targetHeight : targetWidth;
    canvas.height = rotated ? targetWidth : targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }

    applyOrientationTransform(ctx, orientation, targetWidth, targetHeight);
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    let outputType: "image/jpeg" | "image/png" = "image/jpeg";
    if (file.type === "image/png") {
      const hasAlpha = hasTransparency(ctx, canvas.width, canvas.height);
      outputType = hasAlpha ? "image/png" : "image/jpeg";
      if (!hasAlpha) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        applyOrientationTransform(ctx, orientation, targetWidth, targetHeight);
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      }
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      applyOrientationTransform(ctx, orientation, targetWidth, targetHeight);
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Failed to encode resized image."));
          }
        },
        outputType,
        outputType === "image/jpeg" ? JPEG_QUALITY : undefined
      );
    });

    const extension = outputType === "image/png" ? "png" : "jpg";
    const baseName = file.name.replace(/\.[a-z0-9]+$/i, "");
    const nextName = baseName ? `${baseName}.${extension}` : `upload.${extension}`;

    return new File([blob], nextName, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } catch (error) {
    console.error("Failed to resize image. Uploading original.", error);
    return file;
  } finally {
    loaded?.cleanup();
  }
}

function getPhotoExtension(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") {
    return "jpg";
  }
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/webp") {
    return "webp";
  }
  if (type === "image/heic") {
    return "heic";
  }
  if (type === "image/heif") {
    return "heif";
  }
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "jpg";
}

function buildPhotoPath(productId: string, file: File) {
  const extension = getPhotoExtension(file);
  const fileId = crypto.randomUUID();
  return `products/${productId}/${fileId}.${extension}`;
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

  const handlePhotoRemove = () => {
    if (isSubmitting) {
      return;
    }
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
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
        warnings.push("제품은 저장됐지만 초기 재고 등록에 실패했어요.");
      }
    }

    if (photoFile) {
      const uploadFile = await resizeImageForUpload(photoFile);
      const photoPath = buildPhotoPath(productData.id, uploadFile);
      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(photoPath, uploadFile, { upsert: false });

      if (uploadError) {
        console.error("Failed to upload product photo", {
          message: uploadError?.message,

        });
        warnings.push("제품은 저장됐지만 사진 업로드에 실패했어요.");
      } else {
        const { error: updateError } = await supabase
          .from("products")
          .update({ photo_url: photoPath })
          .eq("id", productData.id);

        if (updateError) {
          console.error("Failed to update product photo", {
            message: updateError?.message,
            details: updateError?.details,
            hint: updateError?.hint,
            code: updateError?.code,
          });
          warnings.push("제품은 저장됐지만 사진 연결에 실패했어요.");
          const { error: cleanupError } = await supabase.storage
            .from("product-photos")
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

            <form
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
              onSubmit={handleSubmit}
            >
              <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>사진</h2>
                <div
                  style={photoSlotStyle}
                  role="button"
                  tabIndex={0}
                  aria-label="사진 선택"
                  onClick={handlePhotoPick}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handlePhotoPick();
                    }
                  }}
                >
                  {photoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreviewUrl}
                      alt="선택된 사진"
                      style={photoImageStyle}
                    />
                  ) : (
                    <span style={photoPlaceholderStyle}>사진</span>
                  )}
                </div>
                <div style={photoActionRowStyle}>
                  <button
                    type="button"
                    style={photoActionButtonStyle}
                    onClick={handlePhotoPick}
                    disabled={isSubmitting}
                  >
                    사진 선택
                  </button>
                  <button
                    type="button"
                    style={photoRemoveButtonStyle}
                    onClick={handlePhotoRemove}
                    disabled={isSubmitting || !photoFile}
                  >
                    사진 제거
                  </button>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />
                {photoError ? <p style={helperTextStyle}>{photoError}</p> : null}
              </div>
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
