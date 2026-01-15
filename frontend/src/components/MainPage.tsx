// frontend/src/components/MainPage.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import clsx from "clsx";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import cityDistrictData from "@/lib/city_district.json";
import WeeklyTimeTableReadOnly, { WeeklyTimeTableSummary } from "@/components/WeeklyTimeTableReadOnly";
import Flag from "@/components/Flag";
import DispatchRequestModal, { CultureCenterBranch } from "@/components/dispatch/DispatchRequestModal";
import { Toaster, toast } from "react-hot-toast"; // ✅ NEW

type TeacherApplication = {
  id: number;
  profile_image_thumbnail?: string | null;
  profile_image?: string | null;

  first_name: string;
  last_name: string;
  korean_name?: string | null;

  gender?: string | null;
  date_of_birth?: string | null;
  age?: number | null;

  nationality?: string | null;
  native_language?: string | null;

  email?: string | null;
  phone_number?: string | null;

  city?: string | null;
  district?: string | null;
  address_line1?: string | null;

  teaching_languages?: string | null;
  preferred_subjects?: string | null;

  total_teaching_experience_years?: string | number | null;
  korea_teaching_experience_years?: string | number | null;

  self_introduction?: string | null;
  education_history?: string | null;
  experience_history?: string | null;
  certifications?: string | null;
  teaching_style?: string | null;
  additional_info?: string | null;

  employment_type?: string | null;
  preferred_locations?: string | null;

  // ✅ JSONField라서 object로 올 수도 있고, 일부 endpoint에서 string으로 올 수도 있어 안전하게 unknown 처리
  available_time_slots?: unknown | null;

  available_from_date?: string | null;

  visa_type?: string | null;
  visa_expiry_date?: string | null;

  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  memo?: string | null;
  evaluation_result?: string | null;

  introduction_youtube_url?: string | null;
};

type AgeBracket = "ALL" | "20S" | "30S" | "40S" | "50S" | "60PLUS";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const ALL_VALUE = "ALL" as const;

function toAbsoluteMediaUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}

function normalize(s?: string | null) {
  return (s || "").trim().toLowerCase();
}

function getAgeBracket(age?: number | null): AgeBracket {
  if (typeof age !== "number" || Number.isNaN(age)) return "ALL";
  if (age >= 60) return "60PLUS";
  if (age >= 50) return "50S";
  if (age >= 40) return "40S";
  if (age >= 30) return "30S";
  if (age >= 20) return "20S";
  return "ALL";
}

function badgeClassByGender(gender?: string | null) {
  switch (gender) {
    case "MALE":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "FEMALE":
      return "bg-pink-50 text-pink-700 ring-pink-200";
    case "OTHER":
      return "bg-purple-50 text-purple-700 ring-purple-200";
    case "PREFER_NOT":
      return "bg-gray-50 text-gray-700 ring-gray-200";
    default:
      return "bg-gray-50 text-gray-700 ring-gray-200";
  }
}

function labelGender(gender?: string | null) {
  switch (gender) {
    case "MALE":
      return "Male";
    case "FEMALE":
      return "Female";
    case "OTHER":
      return "Other";
    case "PREFER_NOT":
      return "Prefer not to say";
    default:
      return "Unknown";
  }
}

function labelAgeBracket(b: AgeBracket) {
  switch (b) {
    case "20S":
      return "20s";
    case "30S":
      return "30s";
    case "40S":
      return "40s";
    case "50S":
      return "50s";
    case "60PLUS":
      return "60+";
    default:
      return "All";
  }
}

// ✅ Nationality -> Flag Emoji + Label
const NATIONALITY_META = {
  USA: { iso2: "US", label: "United States / 미국" },
  UK: { iso2: "GB", label: "United Kingdom / 영국" },
  CANADA: { iso2: "CA", label: "Canada / 캐나다" },
  IRELAND: { iso2: "IE", label: "Ireland / 아일랜드" },
  AUSTRALIA: { iso2: "AU", label: "Australia / 호주" },
  NEW_ZEALAND: { iso2: "NZ", label: "New Zealand / 뉴질랜드" },
  SOUTH_AFRICA: { iso2: "ZA", label: "South Africa / 남아프리카공화국" },
  PHILIPPINES: { iso2: "PH", label: "Philippines / 필리핀" },
  SOUTH_KOREA: { iso2: "KR", label: "South Korea / 대한민국" },
  JAPAN: { iso2: "JP", label: "Japan / 일본" },
  CHINA: { iso2: "CN", label: "China / 중국" },
  OTHER: { iso2: "UN", label: "Other / 기타" },
} as const;

type NationalityKey = keyof typeof NATIONALITY_META;

function normalizeNationalityKey(raw?: string | null): NationalityKey | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;

  const upper = v.toUpperCase().replace(/[\s-]+/g, "_");
  if (upper in NATIONALITY_META) return upper as NationalityKey;

  const n = v.toLowerCase();
  if (n.includes("united states") || n === "usa") return "USA";
  if (n.includes("united kingdom") || n === "uk" || n.includes("britain")) return "UK";
  if (n.includes("canada")) return "CANADA";
  if (n.includes("ireland")) return "IRELAND";
  if (n.includes("australia")) return "AUSTRALIA";
  if (n.includes("new zealand")) return "NEW_ZEALAND";
  if (n.includes("south africa")) return "SOUTH_AFRICA";
  if (n.includes("philippines")) return "PHILIPPINES";
  if (n.includes("south korea") || n === "korea" || n.includes("대한민국")) return "SOUTH_KOREA";
  if (n.includes("japan") || n.includes("일본")) return "JAPAN";
  if (n.includes("china") || n.includes("중국")) return "CHINA";
  if (n.includes("other") || n.includes("기타")) return "OTHER";

  return "OTHER";
}

function renderNationalityWithFlag(raw?: string | null) {
  const key = normalizeNationalityKey(raw);
  if (!key) return <span>-</span>;

  const meta = NATIONALITY_META[key];
  const cleaned = (raw || "").trim();
  const cleanedAsKey = cleaned.toUpperCase().replace(/[\s-]+/g, "_");
  const isRawCode = cleaned !== "" && cleanedAsKey === key;
  const text = isRawCode ? meta.label : cleaned || meta.label;

  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <Flag countryCode={meta.iso2} label={meta.label} size={16} className="shrink-0" />
      <span>{text}</span>
    </span>
  );
}

function Field({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  const display = value === null || value === undefined || value === "" ? "-" : value;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={clsx("text-right text-sm font-medium text-gray-900", mono && "font-mono")}>{display}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function TextBlock({ text }: { text?: string | null }) {
  if (!text?.trim()) {
    return <div className="text-sm text-gray-500">-</div>;
  }
  return <div className="text-sm leading-6 whitespace-pre-wrap text-gray-800">{text}</div>;
}

export default function MainPage() {
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherApplication[]>([]);

  // ===== Dispatch Request (Manager Request) (minimal state only) =====
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [branches, setBranches] = useState<CultureCenterBranch[]>([]);
  const [reqSuccess, setReqSuccess] = useState<string | null>(null);

  const openDispatchModal = async () => {
    setDispatchOpen(true);

    // 지점 목록 로딩 (최초 1회 or 비어있을 때만)
    if (branches.length > 0) return;

    setBranchesLoading(true);
    setBranchesError(null);
    try {
      const res = await api.get("/culture-centers/branches/");
      const data = Array.isArray(res.data) ? res.data : [];
      setBranches(data);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401) setBranchesError("로그인이 필요합니다. (401)");
      else setBranchesError("문화센터 지점 목록을 불러오지 못했습니다.");
      setBranches([]);
    } finally {
      setBranchesLoading(false);
    }
  };

  const closeDispatchModal = () => {
    setDispatchOpen(false);
  };

  // 조건 검색(복합) UI 상태 (조건 검색창만 사용)
  const [sido, setSido] = useState<string>(ALL_VALUE);
  const [sigungu, setSigungu] = useState<string>(ALL_VALUE);
  const [gu, setGu] = useState<string>(ALL_VALUE);

  // 조건 검색: language / gender / age / nationality
  const [advLanguage, setAdvLanguage] = useState<string>(ALL_VALUE);
  const [advGender, setAdvGender] = useState<string>(ALL_VALUE);
  const [advAgeBracket, setAdvAgeBracket] = useState<AgeBracket>("ALL");
  const [advNationality, setAdvNationality] = useState<string>(ALL_VALUE); // ✅ NEW

  const resetFilters = () => {
    setSido(ALL_VALUE);
    setSigungu(ALL_VALUE);
    setGu(ALL_VALUE);
    setAdvLanguage(ALL_VALUE);
    setAdvGender(ALL_VALUE);
    setAdvAgeBracket("ALL");
    setAdvNationality(ALL_VALUE); // ✅ NEW
  };

  const sidoOptions = useMemo(() => {
    const s = (cityDistrictData as any)?.sido;
    if (!Array.isArray(s)) return [];
    return s.map((x: any) => String(x?.name)).filter(Boolean);
  }, []);

  const sigunguOptions = useMemo(() => {
    if (sido === ALL_VALUE) return [];
    const s = (cityDistrictData as any)?.sido;
    const found = Array.isArray(s) ? s.find((x: any) => String(x?.name) === sido) : null;
    const districts = found?.districts;
    if (!Array.isArray(districts)) return [];
    return districts.map((d: any) => String(d?.name)).filter(Boolean);
  }, [sido]);

  const guOptions = useMemo(() => {
    if (sido === ALL_VALUE || sigungu === ALL_VALUE) return [];
    const s = (cityDistrictData as any)?.sido;
    const foundSido = Array.isArray(s) ? s.find((x: any) => String(x?.name) === sido) : null;
    const sigunguList = foundSido?.districts;
    const foundSigungu = Array.isArray(sigunguList) ? sigunguList.find((d: any) => String(d?.name) === sigungu) : null;
    const inner = foundSigungu?.districts;
    if (!Array.isArray(inner)) return [];
    return inner.map((g: any) => String(g?.name)).filter(Boolean);
  }, [sido, sigungu]);

  // ✅ NEW: 국적 옵션(고정 choices 기반)
  const nationalityOptions = useMemo(() => {
    const keys = Object.keys(NATIONALITY_META) as NationalityKey[];
    return keys.map((k) => ({ key: k, label: NATIONALITY_META[k].label }));
  }, []);

  useEffect(() => {
    setSigungu(ALL_VALUE);
    setGu(ALL_VALUE);
  }, [sido]);

  useEffect(() => {
    setGu(ALL_VALUE);
  }, [sigungu]);

  // 상세 모달 상태
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [teacherDetail, setTeacherDetail] = useState<TeacherApplication | null>(null);

  // ✅ PDF 저장: 캡처 대상 ref + 생성 상태
  const pdfRef = useRef<HTMLDivElement | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const safeFileName = (s: string) =>
    s
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 80);

  const detailThumb = toAbsoluteMediaUrl(teacherDetail?.profile_image_thumbnail);
  const detailFullName = `${teacherDetail?.first_name || ""} ${teacherDetail?.last_name || ""}`.trim();

  const downloadDetailAsPdf = async () => {
    if (!pdfRef.current) return;
    setPdfGenerating(true);

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      try {
        const fontsAny = (document as any).fonts;
        if (fontsAny?.ready) await fontsAny.ready;
      } catch {}

      const root = pdfRef.current;
      const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-block='true']"));
      const targets = blocks.length ? blocks : [root];

      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;

      let cursorY = margin;

      const addCanvasToPdf = (canvas: HTMLCanvasElement) => {
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight <= contentHeight) {
          if (cursorY + imgHeight > margin + contentHeight) {
            pdf.addPage();
            cursorY = margin;
          }
          pdf.addImage(imgData, "PNG", margin, cursorY, imgWidth, imgHeight);
          cursorY += imgHeight + 2;
          return;
        }

        if (cursorY !== margin) {
          pdf.addPage();
          cursorY = margin;
        }

        let heightLeft = imgHeight;
        let position = margin;

        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;

        while (heightLeft > 0) {
          pdf.addPage();
          position = margin - (imgHeight - heightLeft);
          pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
          heightLeft -= contentHeight;
        }

        cursorY = margin;
      };

      for (const el of targets) {
        const canvas = await html2canvas(el, {
          scale: Math.min(2, window.devicePixelRatio || 2),
          useCORS: true,
          backgroundColor: "#ffffff",
          onclone: (clonedDoc) => {
            const clonedRoot = clonedDoc.querySelector("[data-pdf-root='true']") as HTMLElement | null;
            if (!clonedRoot) return;

            clonedRoot.querySelectorAll<HTMLElement>("[data-pdf-ignore='true']").forEach((node) => {
              node.style.display = "none";
            });

            const style = clonedDoc.createElement("style");
            style.textContent = `
              [data-pdf-root="true"], [data-pdf-root="true"] * {
                font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
                -webkit-font-smoothing: antialiased;
                text-rendering: geometricPrecision;
                letter-spacing: 0 !important;
                word-break: keep-all;
                line-break: strict;
              }
            `;
            clonedDoc.head.appendChild(style);
          },
        });

        addCanvasToPdf(canvas);
      }

      const id = selectedTeacherId ?? "teacher";
      const name = safeFileName(detailFullName || `Teacher_${id}`);
      pdf.save(`${name}_detail_${id}.pdf`);
    } catch (err) {
      console.error(err);
      alert("PDF 생성에 실패했습니다. 콘솔 로그를 확인해 주세요.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const fetchTeachers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/teacher-applications/admin/list/");
      const data = Array.isArray(res.data) ? res.data : [];
      setTeachers(data);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) setError("관리자 권한이 필요합니다. (403 Forbidden)");
      else if (status === 401) setError("로그인이 필요합니다. (401 Unauthorized)");
      else setError("강사 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const openTeacherDetail = async (id: number) => {
    setSelectedTeacherId(id);
    setDetailLoading(true);
    setDetailError(null);
    setTeacherDetail(null);

    try {
      const res = await api.get(`/teacher-applications/admin/${id}/`);
      setTeacherDetail(res.data);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) setDetailError("해당 강사 정보를 찾을 수 없습니다. (404)");
      else if (status === 403) setDetailError("관리자 권한이 필요합니다. (403)");
      else setDetailError("상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeTeacherDetail = () => {
    setSelectedTeacherId(null);
    setTeacherDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // 모달 열렸을 때: ESC 닫기 + body 스크롤 잠금 (Teacher Detail / Dispatch Request 공용)
  const anyModalOpen = selectedTeacherId !== null || dispatchOpen;

  useEffect(() => {
    if (!anyModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      if (dispatchOpen) closeDispatchModal();
      else if (selectedTeacherId !== null) closeTeacherDetail();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anyModalOpen, dispatchOpen, selectedTeacherId]);

  useEffect(() => {
    if (!anyModalOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [anyModalOpen]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const combinedLocation = normalize(`${t.city || ""} ${t.district || ""}`);

      if (sido !== ALL_VALUE && !combinedLocation.includes(normalize(sido))) return false;
      if (sigungu !== ALL_VALUE && !combinedLocation.includes(normalize(sigungu))) return false;
      if (gu !== ALL_VALUE && !combinedLocation.includes(normalize(gu))) return false;

      if (advLanguage !== ALL_VALUE && normalize(t.teaching_languages) !== normalize(advLanguage)) return false;
      if (advGender !== ALL_VALUE && (t.gender || "") !== advGender) return false;
      if (advAgeBracket !== "ALL" && getAgeBracket(t.age ?? null) !== advAgeBracket) return false;

      // ✅ NEW: nationality filter
      if (advNationality !== ALL_VALUE) {
        const tKey = normalizeNationalityKey(t.nationality);
        if (tKey !== advNationality) return false;
      }

      return true;
    });
  }, [teachers, sido, sigungu, gu, advLanguage, advGender, advAgeBracket, advNationality]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const renderAdvancedSearchControls = () => {
    return (
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full min-w-0 items-center gap-2">
          <select
            value={sido}
            onChange={(e) => setSido(e.target.value)}
            className="w-full min-w-[150px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
            title="Location (시/도)">
            <option value={ALL_VALUE}>지역 전체</option>
            {sidoOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={sigungu}
            onChange={(e) => setSigungu(e.target.value)}
            disabled={sido === ALL_VALUE}
            className="w-full min-w-[160px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100 disabled:opacity-60"
            title="Location (시/군/구)">
            <option value={ALL_VALUE}>시/군/구 전체</option>
            {sigunguOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={gu}
            onChange={(e) => setGu(e.target.value)}
            disabled={sido === ALL_VALUE || sigungu === ALL_VALUE || guOptions.length === 0}
            className="w-full min-w-[140px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100 disabled:opacity-60"
            title="Location (일반구)">
            <option value={ALL_VALUE}>구 전체</option>
            {guOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <div></div>
          <select
            value={advLanguage}
            onChange={(e) => setAdvLanguage(e.target.value)}
            className="w-[170px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
            title="Language">
            <option value={ALL_VALUE}>전체 언어</option>
            <option value="English">English</option>
            <option value="Japanese">Japanese</option>
            <option value="Chinese">Chinese</option>
            <option value="Spanish">Spanish</option>
          </select>

          <select
            value={advNationality}
            onChange={(e) => setAdvNationality(e.target.value)}
            className="w-[190px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
            title="Nationality">
            <option value={ALL_VALUE}>전체 국적</option>
            {nationalityOptions.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>

          <select
            value={advGender}
            onChange={(e) => setAdvGender(e.target.value)}
            className="w-[170px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
            title="Gender">
            <option value={ALL_VALUE}>전체 성별</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT">Prefer not to say</option>
          </select>

          <select
            value={advAgeBracket}
            onChange={(e) => setAdvAgeBracket(e.target.value as AgeBracket)}
            className="w-[160px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
            title="Age">
            <option value="ALL">전체 연령대</option>
            <option value="20S">20s</option>
            <option value="30S">30s</option>
            <option value="40S">40s</option>
            <option value="50S">50s</option>
            <option value="60PLUS">60+</option>
          </select>
        </div>
      </div>
    );
  };

  const activeFilterLabel = useMemo(() => {
    const locParts = [sido !== ALL_VALUE ? sido : null, sigungu !== ALL_VALUE ? sigungu : null, gu !== ALL_VALUE ? gu : null].filter(Boolean);
    const locText = locParts.length ? locParts.join(" / ") : "지역 전체";
    const langText = advLanguage === ALL_VALUE ? "전체 언어" : advLanguage;
    const natText =
      advNationality === ALL_VALUE ? "전체 국적" : NATIONALITY_META[(advNationality as NationalityKey) ?? "OTHER"]?.label || advNationality;
    const genderText = advGender === ALL_VALUE ? "전체 성별" : labelGender(advGender);
    const ageText = advAgeBracket === "ALL" ? "전체 연령대" : labelAgeBracket(advAgeBracket);

    return `${locText} - ${langText} - ${natText} - ${genderText} - ${ageText}`;
  }, [sido, sigungu, gu, advLanguage, advNationality, advGender, advAgeBracket]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      {/* ✅ Toast container */}
      {/* 기본값은 top-center 이지만 모달창 특성에 따라 top-right 로 위치 변경 */}
      <Toaster position="top-right" />

      {/* Navbar */}
      <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <button className="flex min-w-[160px] items-center gap-2 hover:cursor-pointer" onClick={resetFilters}>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gray-900 text-xl font-semibold text-white">F</div>
            <div className="leading-tight">
              <div className="text-xl font-semibold">Friending</div>
              <div className="text-xs text-gray-500">Teacher Directory</div>
            </div>
          </button>

          <div className="flex w-full items-center gap-2">
            <div className="w-full">{renderAdvancedSearchControls()}</div>
          </div>

          <div className="flex flex-col items-center justify-end gap-3">
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:cursor-pointer hover:bg-black focus:ring-4 focus:ring-gray-200 focus:outline-none">
              Logout
            </button>

            <div className="max-w-[220px] truncate text-sm text-gray-700 underline" title={user?.email || ""}>
              {user?.email || ""}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* ===== Manager: Dispatch Request CTA ===== */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-base font-semibold text-gray-900">강사 파견 요청</div>
              <div className="mt-1 text-sm text-gray-600">
                문화센터 지점을 선택하고, 강의 정보(언어/강좌/요일/시간/기간)를 입력하여 강사 파견을 요청할 수 있습니다.
              </div>
            </div>

            <div className="flex items-center gap-2">
              {reqSuccess && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
                  {reqSuccess}
                </span>
              )}
              <button
                onClick={openDispatchModal}
                className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black focus:ring-4 focus:ring-gray-200 focus:outline-none">
                요청 작성하기
              </button>
            </div>
          </div>
        </section>

        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Registered Foreign Teachers</h1>
            <p className="mt-1 text-sm text-gray-600">Browse teacher cards and filter by conditions.</p>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="rounded-full bg-gray-100 px-3 py-1 ring-1 ring-gray-200">{activeFilterLabel}</span>
            <span className="rounded-full bg-gray-100 px-3 py-1 ring-1 ring-gray-200">
              {filteredTeachers.length} / {teachers.length}
            </span>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <div className="font-medium">Error</div>
            <div className="mt-1">{error}</div>
          </div>
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 animate-pulse rounded-2xl bg-gray-100" />
                  <div className="flex-1">
                    <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
                    <div className="mt-2 h-3 w-24 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-4/6 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : teachers.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="text-base font-semibold">등록된 지원서가 없습니다.</div>
            <div className="mt-1 text-sm text-gray-600">TeacherApplication 데이터가 생성되면 이곳에 카드 형태로 표시됩니다.</div>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="text-base font-semibold">조건에 맞는 강사가 없습니다.</div>
            <div className="mt-1 text-sm text-gray-600">검색 조건을 변경해 보세요.</div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTeachers.map((t) => {
              const thumb = toAbsoluteMediaUrl(t.profile_image_thumbnail);
              const fullName = `${t.first_name} ${t.last_name}`.trim();
              return (
                <button
                  key={t.id}
                  onClick={() => openTeacherDetail(t.id)}
                  className="group w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus:ring-4 focus:ring-gray-100 focus:outline-none">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
                      {thumb ? (
                        <img src={thumb} alt={`${fullName} thumbnail`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs font-medium text-gray-500">No Image</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-base font-semibold text-gray-900 group-hover:text-black">{fullName || `Teacher #${t.id}`}</div>
                        <span
                          className={clsx(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                            badgeClassByGender(t.gender),
                          )}>
                          {labelGender(t.gender)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="truncate text-sm text-gray-600">{renderNationalityWithFlag(t.nationality)}</div>
                        <div className="text-xs text-gray-500">Age {typeof t.age === "number" ? t.age : "-"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="text-gray-500">Language</div>
                      <div className="font-medium text-gray-900">{t.teaching_languages || "-"}</div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="text-gray-500">Location</div>
                      <div className="font-medium text-gray-900">{[t.city, t.district].filter(Boolean).join(" · ") || "-"}</div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="text-gray-500">Experience</div>
                      <div className="font-medium text-gray-900">{t.total_teaching_experience_years ?? "-"} yrs</div>
                    </div>

                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-gray-700">Evaluation</div>
                        <div className="text-xs font-medium text-gray-500">Click to view details</div>
                      </div>
                      <div className="mt-1 line-clamp-3 text-sm text-gray-700">
                        {t.evaluation_result?.trim() ? t.evaluation_result : "No evaluation result yet."}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedTeacherId !== null && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
          <div
            className="absolute inset-0 overflow-y-auto"
            onMouseDown={(e) => {
              // 스크롤 레이어(=모달 바깥)를 직접 클릭한 경우에만 닫기
              if (e.target === e.currentTarget) closeTeacherDetail();
            }}>
            <div className="mx-auto flex min-h-full max-w-4xl items-center px-4 py-10 sm:px-6">
              <div
                ref={pdfRef}
                data-pdf-root="true"
                role="dialog"
                aria-modal="true"
                className="w-full rounded-3xl border border-gray-200 bg-gray-50 shadow-2xl"
                onMouseDown={(e) => {
                  // 모달 내부 클릭은 바깥 클릭 핸들러로 전파되지 않게 막기
                  e.stopPropagation();
                }}>
                {/* Header */}
                <div
                  data-pdf-block="true"
                  className="flex items-start justify-between gap-4 rounded-t-3xl border-b border-gray-200 bg-white px-5 pt-8 pb-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
                      {detailThumb ? (
                        <img src={detailThumb} alt={`${detailFullName} thumbnail`} className="h-full w-full object-cover" crossOrigin="anonymous" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs font-medium text-gray-500">No Image</div>
                      )}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-gray-900">
                        {detailLoading ? "Loading..." : detailFullName || `Teacher #${selectedTeacherId}`}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                          {teacherDetail?.teaching_languages}
                        </span>
                        <span
                          className={clsx(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                            badgeClassByGender(teacherDetail?.gender),
                          )}>
                          {labelGender(teacherDetail?.gender)}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                          Age: {typeof teacherDetail?.age === "number" ? teacherDetail?.age : "-"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                          Teacher_ID: #{teacherDetail?.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    data-pdf-ignore="true"
                    onClick={closeTeacherDetail}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 focus:outline-none">
                    Close (Esc)
                  </button>
                </div>

                {/* Body */}
                <div className="space-y-4 px-5 py-5 sm:px-6">
                  {detailError ? (
                    <div data-pdf-block="true" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      {detailError}
                      <div className="mt-3" data-pdf-ignore="true">
                        <button
                          onClick={() => openTeacherDetail(selectedTeacherId)}
                          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black focus:ring-4 focus:ring-gray-200 focus:outline-none">
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : detailLoading ? (
                    <div data-pdf-block="true" className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
                      상세 정보를 불러오는 중입니다...
                    </div>
                  ) : (
                    <>
                      <div data-pdf-block="true" className="mb-10 grid gap-4 lg:grid-cols-2">
                        <Section title="Basic Info">
                          <Field label="Full name" value={`${teacherDetail?.first_name || ""} ${teacherDetail?.last_name || ""}`.trim() || "-"} />
                          <Field label="Korean name" value={teacherDetail?.korean_name || "-"} />
                          <Field label="Nationality" value={renderNationalityWithFlag(teacherDetail?.nationality)} />
                          <Field label="Teaching language" value={teacherDetail?.teaching_languages || "-"} />
                          <Field label="Preferred subjects" value={teacherDetail?.preferred_subjects || "-"} />
                          <Field
                            label="Intro video"
                            value={
                              teacherDetail?.introduction_youtube_url ? (
                                <a
                                  href={teacherDetail.introduction_youtube_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="italic underline underline-offset-2 hover:text-gray-700">
                                  Click to watch!
                                </a>
                              ) : (
                                "-"
                              )
                            }
                          />
                        </Section>

                        <Section title="Location & Experience">
                          <Field label="City / District" value={[teacherDetail?.city, teacherDetail?.district].filter(Boolean).join(" · ") || "-"} />
                          <Field label="Total experience (years)" value={teacherDetail?.total_teaching_experience_years ?? "-"} />
                          <Field label="Korea experience (years)" value={teacherDetail?.korea_teaching_experience_years ?? "-"} />
                        </Section>
                      </div>

                      {/* ✅ Availability 섹션(상세 모달용) */}
                      <div data-pdf-block="true">
                        <Section title="Availability / 강의 가능 시간대">
                          <WeeklyTimeTableReadOnly value={teacherDetail?.available_time_slots} showMiniGrid={true} />
                        </Section>
                      </div>

                      <div data-pdf-block="true">
                        <Section title="Self Introduction">
                          <TextBlock text={teacherDetail?.self_introduction} />
                        </Section>
                      </div>

                      <div data-pdf-block="true">
                        <Section title="Education History">
                          <TextBlock text={teacherDetail?.education_history} />
                        </Section>
                      </div>

                      <div data-pdf-block="true">
                        <Section title="Experience History">
                          <TextBlock text={teacherDetail?.experience_history} />
                        </Section>
                      </div>

                      <div data-pdf-block="true" className="grid gap-4 lg:grid-cols-2">
                        <Section title="Certifications">
                          <TextBlock text={teacherDetail?.certifications} />
                        </Section>

                        <Section title="Teaching Style & Strengths">
                          <TextBlock text={teacherDetail?.teaching_style} />
                        </Section>
                      </div>

                      <div data-pdf-block="true">
                        <Section title="Additional Info">
                          <TextBlock text={teacherDetail?.additional_info} />
                        </Section>
                      </div>

                      <div data-pdf-block="true">
                        <Section title="Admin Evaluation">
                          <TextBlock text={teacherDetail?.evaluation_result} />
                        </Section>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer actions */}
                <div
                  data-pdf-ignore="true"
                  className="flex items-center justify-end gap-2 rounded-b-3xl border-t border-gray-200 bg-white px-5 py-4 sm:px-6">
                  <button
                    onClick={() => openTeacherDetail(selectedTeacherId)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition hover:cursor-pointer hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 focus:outline-none">
                    Refresh Detail
                  </button>

                  {/* ✅ NEW: PDF 저장 버튼 */}
                  <button
                    onClick={downloadDetailAsPdf}
                    disabled={detailLoading || !!detailError || pdfGenerating}
                    className={clsx(
                      "rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition focus:ring-4 focus:ring-gray-100 focus:outline-none",
                      detailLoading || !!detailError || pdfGenerating ? "cursor-not-allowed opacity-60" : "hover:cursor-pointer hover:bg-gray-50",
                    )}>
                    {pdfGenerating ? "Generating PDF..." : "Save as PDF"}
                  </button>

                  <button
                    onClick={closeTeacherDetail}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:cursor-pointer hover:bg-black focus:ring-4 focus:ring-gray-200 focus:outline-none">
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Dispatch Request Modal (external component) */}
      <DispatchRequestModal
        open={dispatchOpen}
        onClose={closeDispatchModal}
        branches={branches}
        branchesLoading={branchesLoading}
        branchesError={branchesError}
        defaultApplicantEmail={user?.email || ""}
        onSubmitSuccess={(msg) => {
          setReqSuccess(msg);
          toast.success(msg, { id: "dispatch-success" }); // ✅ optional
        }}
        onSubmitError={(msg) => {
          toast.error(msg, { id: "dispatch-error" }); // ✅ NEW
        }}
      />

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>© {new Date().getFullYear()} Friending</div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">Admin Teacher List</span>
            <span className="h-1 w-1 rounded-full bg-gray-300" />
            <span className="text-gray-500">Modern UI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
