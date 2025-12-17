"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import cityDistrictData from "@/lib/city_district.json";

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
  available_time_slots?: string | null;
  available_from_date?: string | null;

  visa_type?: string | null;
  visa_expiry_date?: string | null;

  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  memo?: string | null;
  evaluation_result?: string | null;
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

  // 조건 검색(복합) UI 상태 (조건 검색창만 사용)
  // location: 시/도 -> 시/군/구 -> (선택) 구(일반구)
  const [sido, setSido] = useState<string>(ALL_VALUE);
  const [sigungu, setSigungu] = useState<string>(ALL_VALUE);
  const [gu, setGu] = useState<string>(ALL_VALUE);

  // 조건 검색: language / gender / age
  const [advLanguage, setAdvLanguage] = useState<string>(ALL_VALUE);
  const [advGender, setAdvGender] = useState<string>(ALL_VALUE);
  const [advAgeBracket, setAdvAgeBracket] = useState<AgeBracket>("ALL");

  const resetFilters = () => {
    setSido(ALL_VALUE);
    setSigungu(ALL_VALUE);
    setGu(ALL_VALUE);
    setAdvLanguage(ALL_VALUE);
    setAdvGender(ALL_VALUE);
    setAdvAgeBracket("ALL");
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

  // location select 연동: 상위 변경 시 하위 초기화
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

  const fetchTeachers = async () => {
    setLoading(true);
    setError(null);
    try {
      // 관리자용 목록 엔드포인트 (permissions.IsAdminUser)
      const res = await api.get("/teacher-applications/admin/list/");
      const data = Array.isArray(res.data) ? res.data : [];
      setTeachers(data);
    } catch (e: any) {
      // 권한 문제/네트워크 문제 등
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
      // 관리자용 상세 엔드포인트
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

  // 모달 열렸을 때: ESC 닫기 + body 스크롤 잠금
  useEffect(() => {
    if (selectedTeacherId === null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTeacherDetail();
    };
    window.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedTeacherId]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      // 조건 검색(복합): location + language + gender + age 를 AND로 결합
      const combinedLocation = normalize(`${t.city || ""} ${t.district || ""}`);

      if (sido !== ALL_VALUE && !combinedLocation.includes(normalize(sido))) return false;
      if (sigungu !== ALL_VALUE && !combinedLocation.includes(normalize(sigungu))) return false;
      if (gu !== ALL_VALUE && !combinedLocation.includes(normalize(gu))) return false;

      if (advLanguage !== ALL_VALUE && normalize(t.teaching_languages) !== normalize(advLanguage)) return false;
      if (advGender !== ALL_VALUE && (t.gender || "") !== advGender) return false;
      if (advAgeBracket !== "ALL" && getAgeBracket(t.age ?? null) !== advAgeBracket) return false;

      return true;
    });
  }, [teachers, sido, sigungu, gu, advLanguage, advGender, advAgeBracket]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const renderAdvancedSearchControls = () => {
    return (
      <div className="flex w-full items-center gap-2">
        {/* location */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
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

        {/* language */}
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

        {/* gender */}
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

        {/* age */}
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
    );
  };

  const activeFilterLabel = useMemo(() => {
    const locParts = [sido !== ALL_VALUE ? sido : null, sigungu !== ALL_VALUE ? sigungu : null, gu !== ALL_VALUE ? gu : null].filter(Boolean);
    const locText = locParts.length ? locParts.join(" / ") : "지역 전체";
    const langText = advLanguage === ALL_VALUE ? "전체 언어" : advLanguage;
    const genderText = advGender === ALL_VALUE ? "전체 성별" : labelGender(advGender);
    const ageText = advAgeBracket === "ALL" ? "전체 연령대" : labelAgeBracket(advAgeBracket);

    return `${locText} - ${langText} - ${genderText} - ${ageText}`;
  }, [sido, sigungu, gu, advLanguage, advGender, advAgeBracket]);

  const detailThumb = toAbsoluteMediaUrl(teacherDetail?.profile_image_thumbnail);
  const detailFullName = `${teacherDetail?.first_name || ""} ${teacherDetail?.last_name || ""}`.trim();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      {/* Navbar */}
      <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          {/* Left: Logo */}
          <div className="flex min-w-[160px] items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gray-900 text-xl font-semibold text-white">F</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Friending</div>
              <div className="text-xs text-gray-500">Teacher Directory</div>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex w-full items-center gap-2">
            <div className="w-full">{renderAdvancedSearchControls()}</div>

            <button
              onClick={resetFilters}
              className="hidden shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 focus:outline-none sm:inline-flex">
              Reset
            </button>
          </div>

          {/* Right: Email + Logout */}
          <div className="flex min-w-[260px] items-center justify-end gap-3">
            <div className="max-w-[220px] truncate text-sm text-gray-700 underline" title={user?.email || ""}>
              {user?.email || ""}
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:cursor-pointer hover:bg-black focus:ring-4 focus:ring-gray-200 focus:outline-none">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
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
              const fullName = `${t.first_name || ""} ${t.last_name || ""}`.trim();
              const ageText = typeof t.age === "number" ? `${t.age}` : "-";
              const locationText = [t.city, t.district].filter(Boolean).join(" · ") || "-";

              return (
                <article
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openTeacherDetail(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openTeacherDetail(t.id);
                  }}
                  className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:ring-4 focus:ring-gray-100 focus:outline-none">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
                      {thumb ? (
                        <img src={thumb} alt={`${fullName} thumbnail`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs font-medium text-gray-500">No Image</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold">{fullName || "Unknown name"}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={clsx(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                                badgeClassByGender(t.gender),
                              )}>
                              {labelGender(t.gender)}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                              Age: {ageText}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 rounded-xl bg-gray-900/5 px-2 py-1 text-xs font-medium text-gray-700">#{t.id}</div>
                      </div>

                      <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-gray-500">Nationality</dt>
                          <dd className="text-right font-medium text-gray-900">{t.nationality || "-"}</dd>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-gray-500">Location</dt>
                          <dd className="text-right font-medium text-gray-900">{locationText}</dd>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-gray-500">Teaching</dt>
                          <dd className="text-right font-medium text-gray-900">{t.teaching_languages || "-"}</dd>
                        </div>
                      </dl>
                    </div>
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
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedTeacherId !== null && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeTeacherDetail} aria-hidden="true" />
          <div className="absolute inset-0 overflow-y-auto">
            <div className="mx-auto flex min-h-full max-w-4xl items-center px-4 py-10 sm:px-6">
              <div role="dialog" aria-modal="true" className="w-full rounded-3xl border border-gray-200 bg-gray-50 shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 rounded-t-3xl border-b border-gray-200 bg-white px-5 pt-8 pb-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
                      {detailThumb ? (
                        <img src={detailThumb} alt={`${detailFullName} thumbnail`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs font-medium text-gray-500">No Image</div>
                      )}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-gray-900">
                        {detailLoading ? "Loading..." : detailFullName || `Teacher #${selectedTeacherId}`}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
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
                        {/*<span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">*/}
                        {/*  Status: {teacherDetail?.status || "-"}*/}
                        {/*</span>*/}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={closeTeacherDetail}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 focus:outline-none">
                    Close (Esc)
                  </button>
                </div>

                {/* Body */}
                <div className="space-y-4 px-5 py-5 sm:px-6">
                  {detailError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                      {detailError}
                      <div className="mt-3">
                        <button
                          onClick={() => openTeacherDetail(selectedTeacherId)}
                          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black focus:ring-4 focus:ring-gray-200 focus:outline-none">
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : detailLoading ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">상세 정보를 불러오는 중입니다...</div>
                  ) : (
                    <>
                      <div className="mb-10 grid gap-4 lg:grid-cols-2">
                        <Section title="Basic Info">
                          <Field label="Full name" value={`${teacherDetail?.first_name || ""} ${teacherDetail?.last_name || ""}`.trim() || "-"} />
                          <Field label="Korean name" value={teacherDetail?.korean_name || "-"} />
                          <Field label="Nationality" value={teacherDetail?.nationality || "-"} />
                          <Field label="Native language" value={teacherDetail?.native_language || "-"} />
                          <Field label="Teaching language" value={teacherDetail?.teaching_languages || "-"} />
                          <Field label="Preferred subjects" value={teacherDetail?.preferred_subjects || "-"} />
                        </Section>

                        <Section title="Location & Experience">
                          <Field label="City / District" value={[teacherDetail?.city, teacherDetail?.district].filter(Boolean).join(" · ") || "-"} />
                          {/*<Field label="Address" value={teacherDetail?.address_line1 || "-"} />*/}
                          {/*<Field label="Email" value={teacherDetail?.email || "-"} mono />*/}
                          {/*<Field label="Phone" value={teacherDetail?.phone_number || "-"} mono />*/}
                          <Field label="Total experience (years)" value={teacherDetail?.total_teaching_experience_years ?? "-"} />
                          <Field label="Korea experience (years)" value={teacherDetail?.korea_teaching_experience_years ?? "-"} />
                        </Section>
                      </div>

                      {/*<div className="grid gap-4 lg:grid-cols-2">*/}
                      {/*  <Section title="Experience">*/}
                      {/*    <Field label="Total experience (years)" value={teacherDetail?.total_teaching_experience_years ?? "-"} />*/}
                      {/*    <Field label="Korea experience (years)" value={teacherDetail?.korea_teaching_experience_years ?? "-"} />*/}
                      {/*  </Section>*/}

                      {/*  <Section title="Visa & Meta">*/}
                      {/*    <Field label="Visa type" value={teacherDetail?.visa_type || "-"} />*/}
                      {/*    <Field label="Visa expiry date" value={formatDate(teacherDetail?.visa_expiry_date)} />*/}
                      {/*    <Field label="Created" value={formatDate(teacherDetail?.created_at)} />*/}
                      {/*    <Field label="Updated" value={formatDate(teacherDetail?.updated_at)} />*/}
                      {/*  </Section>*/}
                      {/*</div>*/}

                      <Section title="Self Introduction">
                        <TextBlock text={teacherDetail?.self_introduction} />
                      </Section>

                      <Section title="Education History">
                        <TextBlock text={teacherDetail?.education_history} />
                      </Section>

                      <Section title="Experience History">
                        <TextBlock text={teacherDetail?.experience_history} />
                      </Section>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Section title="Certifications">
                          <TextBlock text={teacherDetail?.certifications} />
                        </Section>

                        <Section title="Teaching Style & Strengths">
                          <TextBlock text={teacherDetail?.teaching_style} />
                        </Section>
                      </div>

                      <Section title="Additional Info">
                        <TextBlock text={teacherDetail?.additional_info} />
                      </Section>

                      <Section title="Admin Evaluation">
                        <TextBlock text={teacherDetail?.evaluation_result} />
                      </Section>

                      {/*{teacherDetail?.memo?.trim() ? (*/}
                      {/*  <Section title="Admin Memo">*/}
                      {/*    <TextBlock text={teacherDetail?.memo} />*/}
                      {/*  </Section>*/}
                      {/*) : null}*/}
                    </>
                  )}
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-2 rounded-b-3xl border-t border-gray-200 bg-white px-5 py-4 sm:px-6">
                  <button
                    onClick={() => openTeacherDetail(selectedTeacherId)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition hover:cursor-pointer hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 focus:outline-none">
                    Refresh Detail
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
