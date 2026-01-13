// frontend/src/components/dispatch/DispatchRequestModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import api from "@/lib/api";
import WeeklyTimeTablePicker, { type AvailableTimeSlots } from "@/components/WeeklyTimeTablePicker"; // ✅ NEW

export type CultureCenterBranch = {
  id: number;
  center_name: string;
  region_name: string;
  branch_name: string;
  address_detail: string;
  center_phone?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
  notes?: string | null;
};

type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

const DAY_OPTIONS: Array<{ key: DayKey; label: string }> = [
  { key: "MON", label: "Mon / 월" },
  { key: "TUE", label: "Tue / 화" },
  { key: "WED", label: "Wed / 수" },
  { key: "THU", label: "Thu / 목" },
  { key: "FRI", label: "Fri / 금" },
  { key: "SAT", label: "Sat / 토" },
  { key: "SUN", label: "Sun / 일" },
];

const LANGUAGE_OPTIONS = ["English", "Japanese", "Chinese", "Spanish", "Korean", "Other"] as const;

type Props = {
  open: boolean;
  onClose: () => void;

  branches: CultureCenterBranch[];
  branchesLoading: boolean;
  branchesError: string | null;

  defaultApplicantEmail?: string;

  onSubmitSuccess?: (message: string) => void;
  onSubmitError?: (message: string) => void; // ✅ NEW
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function minutesToHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function isContiguous(sortedUnique: number[]) {
  for (let i = 1; i < sortedUnique.length; i++) {
    if (sortedUnique[i] !== sortedUnique[i - 1] + 1) return false;
  }
  return true;
}

/**
 * WeeklyTimeTablePicker 선택값(요일별 slotIndex 배열) -> (class_days, start_time, end_time)로 변환
 * 정책(제약):
 * - 선택된 요일마다 "연속된 1개 구간"만 허용
 * - 모든 선택 요일의 시작/종료 시간이 동일해야 함
 */
function deriveClassScheduleFromWeeklySlots(v: AvailableTimeSlots | null) {
  if (!v) {
    return { days: [] as DayKey[], startTime: "", endTime: "", error: null as string | null };
  }

  const step = v.stepMinutes ?? 30;
  const pickedDays: DayKey[] = [];
  let commonStartMin: number | null = null;
  let commonEndMin: number | null = null;

  for (const d of DAY_OPTIONS) {
    const slotsRaw = v.days?.[d.key] ?? [];
    const slots = Array.from(new Set(slotsRaw)).sort((a, b) => a - b);
    if (!slots.length) continue;

    if (!isContiguous(slots)) {
      return {
        days: [],
        startTime: "",
        endTime: "",
        error: "요일별로 연속된 시간대 1개만 선택해 주세요. (예: 19:00-20:30)",
      };
    }

    const startMin = slots[0] * step;
    const endMin = (slots[slots.length - 1] + 1) * step;

    if (commonStartMin === null || commonEndMin === null) {
      commonStartMin = startMin;
      commonEndMin = endMin;
    } else if (commonStartMin !== startMin || commonEndMin !== endMin) {
      return {
        days: [],
        startTime: "",
        endTime: "",
        error: "선택한 모든 요일의 시작/종료 시간이 동일해야 합니다.",
      };
    }

    pickedDays.push(d.key);
  }

  if (pickedDays.length === 0) {
    return { days: [], startTime: "", endTime: "", error: null };
  }

  return {
    days: pickedDays,
    startTime: minutesToHHMM(commonStartMin ?? 0),
    endTime: minutesToHHMM(commonEndMin ?? 0),
    error: null,
  };
}

export default function DispatchRequestModal({
  open,
  onClose,
  branches,
  branchesLoading,
  branchesError,
  defaultApplicantEmail = "",
  onSubmitSuccess,
  onSubmitError, // ✅ NEW
}: Props) {
  // ====== form state ======
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  // ✅ NEW: start_date 필수 에러(필드 단위)
  const [reqStartDateError, setReqStartDateError] = useState<string | null>(null);

  // ✅ 3-step selection: Center -> Region -> Branch
  const [reqCenterName, setReqCenterName] = useState<string>("");
  const [reqRegionName, setReqRegionName] = useState<string>("");
  const [reqCenterId, setReqCenterId] = useState<number | "">("");

  const [reqLanguage, setReqLanguage] = useState<string>("English");
  const [reqLanguageCustom, setReqLanguageCustom] = useState<string>("");

  const [reqCourseTitle, setReqCourseTitle] = useState<string>("");

  // ✅ NEW: weekly timetable selection (요일+시간을 한 번에 선택)
  const [reqWeeklySlots, setReqWeeklySlots] = useState<AvailableTimeSlots | null>(null);
  const [reqScheduleError, setReqScheduleError] = useState<string | null>(null);

  // 서버 payload 필드(기존 유지): class_days + start/end_time
  const [reqDays, setReqDays] = useState<DayKey[]>([]);
  const [reqStartTime, setReqStartTime] = useState<string>("");
  const [reqEndTime, setReqEndTime] = useState<string>("");

  // ✅ start_date를 이제 "필수"로
  const [reqStartDate, setReqStartDate] = useState<string>("");
  const [reqEndDate, setReqEndDate] = useState<string>("");

  const [reqApplicantName, setReqApplicantName] = useState<string>("");
  const [reqApplicantPhone, setReqApplicantPhone] = useState<string>("");
  const [reqApplicantEmail, setReqApplicantEmail] = useState<string>(defaultApplicantEmail || "");

  const [reqTeacherCount, setReqTeacherCount] = useState<number>(1);
  const [reqStudentsCount, setReqStudentsCount] = useState<string>("");
  const [reqExtra, setReqExtra] = useState<string>("");

  const resetDispatchForm = (emailOverride?: string) => {
    setReqError(null);
    setReqStartDateError(null); // ✅ NEW

    setReqCenterName("");
    setReqRegionName("");
    setReqCenterId("");

    setReqLanguage("English");
    setReqLanguageCustom("");

    setReqCourseTitle("");

    setReqWeeklySlots(null);
    setReqScheduleError(null);

    setReqDays([]);
    setReqStartTime("");
    setReqEndTime("");

    setReqStartDate("");
    setReqEndDate("");

    setReqApplicantName("");
    setReqApplicantPhone("");
    setReqApplicantEmail(emailOverride ?? defaultApplicantEmail ?? "");

    setReqTeacherCount(1);
    setReqStudentsCount("");
    setReqExtra("");
  };

  // 모달 열릴 때 기본 이메일 반영 (유저가 변경했을 수도 있으니 "열릴 때"만 리셋)
  useEffect(() => {
    if (!open) return;
    resetDispatchForm(defaultApplicantEmail || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultApplicantEmail]);

  // ✅ weekly timetable -> (days, start/end time) 동기화
  useEffect(() => {
    const derived = deriveClassScheduleFromWeeklySlots(reqWeeklySlots);
    setReqScheduleError(derived.error);
    setReqDays(derived.days);
    setReqStartTime(derived.startTime);
    setReqEndTime(derived.endTime);
  }, [reqWeeklySlots]);

  // ✅ start_date 입력되면 필드 에러 해제
  useEffect(() => {
    if (reqStartDate?.trim()) setReqStartDateError(null);
  }, [reqStartDate]);

  const centerOptions = useMemo(() => {
    const set = new Set<string>();
    branches.forEach((b) => b?.center_name && set.add(b.center_name));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [branches]);

  const regionOptions = useMemo(() => {
    if (!reqCenterName) return [];
    const set = new Set<string>();
    branches.filter((b) => b.center_name === reqCenterName).forEach((b) => b?.region_name && set.add(b.region_name));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [branches, reqCenterName]);

  const branchOptions = useMemo(() => {
    if (!reqCenterName || !reqRegionName) return [];
    return branches
      .filter((b) => b.center_name === reqCenterName && b.region_name === reqRegionName)
      .slice()
      .sort((a, b) => a.branch_name.localeCompare(b.branch_name));
  }, [branches, reqCenterName, reqRegionName]);

  const selectedBranch = useMemo(() => {
    if (!reqCenterId) return null;
    return branches.find((b) => b.id === reqCenterId) || null;
  }, [reqCenterId, branches]);

  const submitDispatchRequest = async () => {
    setReqSubmitting(true);
    setReqError(null);

    try {
      if (!reqCenterId) throw new Error("지점을 선택해 주세요.");
      if (!reqCourseTitle.trim()) throw new Error("강좌명을 입력해 주세요.");

      // ✅ weekly schedule validation
      if (reqScheduleError) throw new Error(reqScheduleError);
      if (reqDays.length === 0) throw new Error("주간 타임테이블에서 강의 요일/시간을 1개 이상 선택해 주세요.");
      if (!reqStartTime || !reqEndTime) throw new Error("주간 타임테이블에서 시작/종료 시간을 선택해 주세요.");

      // ✅ NEW: start_date 필수 검증
      if (!reqStartDate?.trim()) {
        const msg = "수업 시작일을 선택해 주세요.";
        setReqStartDateError(msg);
        throw new Error(msg);
      }

      if (!reqApplicantName.trim()) throw new Error("신청자 이름을 입력해 주세요.");
      if (!reqApplicantPhone.trim()) throw new Error("연락처를 입력해 주세요.");
      if (!reqApplicantEmail.trim()) throw new Error("이메일을 입력해 주세요.");

      const finalLanguage = reqLanguage === "Other" ? reqLanguageCustom.trim() : reqLanguage;
      if (!finalLanguage) throw new Error("강의 언어를 입력/선택해 주세요.");

      const payload = {
        culture_center_id: Number(reqCenterId),
        teaching_language: finalLanguage,
        course_title: reqCourseTitle.trim(),
        class_days: reqDays,
        start_time: reqStartTime || null,
        end_time: reqEndTime || null,
        // ✅ start_date 필수: null로 보내지 않음
        start_date: reqStartDate,
        end_date: reqEndDate || null,
        applicant_name: reqApplicantName.trim(),
        applicant_phone: reqApplicantPhone.trim(),
        applicant_email: reqApplicantEmail.trim(),
        expected_teacher_count: Math.max(1, Number(reqTeacherCount || 1)),
        students_count: reqStudentsCount ? Number(reqStudentsCount) : null,
        extra_requirements: reqExtra.trim() ? reqExtra.trim() : null,
      };

      await api.post("/dispatch-requests/", payload);

      onSubmitSuccess?.("강사 파견 요청이 제출되었습니다.");
      onClose();
    } catch (e: any) {
      const status = e?.response?.status;

      let msg = "요청 제출에 실패했습니다. 잠시 후 다시 시도해 주세요.";

      if (typeof e?.message === "string" && !status) {
        msg = e.message;
      } else if (status === 400) {
        msg = "요청 값이 올바르지 않습니다. 입력 내용을 확인해 주세요.";
      } else if (status === 401) msg = "로그인이 필요합니다. (401)";
      else if (status === 403) msg = "권한이 없습니다. (403)";

      setReqError(msg);
      onSubmitError?.(msg); // ✅ NEW: parent toast
    } finally {
      setReqSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Backdrop click close */}
      <div
        className="absolute inset-0 overflow-y-auto"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}>
        <div className="mx-auto flex min-h-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full rounded-3xl border border-gray-200 bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 rounded-t-3xl border-b border-gray-200 bg-gray-50 px-5 py-5 sm:px-6">
              <div>
                <div className="text-base font-semibold text-gray-900">강사 파견 요청 작성</div>
                <div className="mt-1 text-sm text-gray-600">문화센터 지점과 강의 정보를 입력해 주세요.</div>
              </div>

              <button
                onClick={onClose}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 focus:outline-none">
                Close (Esc)
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-5 py-5 sm:px-6">
              {branchesError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{branchesError}</div>}
              {reqError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{reqError}</div>}

              {/* 1) Branch select */}
              <div className="grid gap-3 rounded-2xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-900">1) 지점 선택</div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <label className="text-sm text-gray-600">문화센터 이름</label>
                    <select
                      value={reqCenterName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setReqCenterName(v);
                        setReqRegionName("");
                        setReqCenterId("");
                      }}
                      disabled={branchesLoading}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100 disabled:opacity-60">
                      <option value="">선택</option>
                      {centerOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="text-sm text-gray-600">지역</label>
                    <select
                      value={reqRegionName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setReqRegionName(v);
                        setReqCenterId("");
                      }}
                      disabled={!reqCenterName || branchesLoading}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100 disabled:opacity-60">
                      <option value="">선택</option>
                      {regionOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="text-sm text-gray-600">지점명</label>
                    <select
                      value={reqCenterId}
                      onChange={(e) => setReqCenterId(e.target.value ? Number(e.target.value) : "")}
                      disabled={!reqCenterName || !reqRegionName || branchesLoading}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100 disabled:opacity-60">
                      <option value="">선택</option>
                      {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.branch_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">{branchesLoading && <div className="mt-1 text-xs text-gray-500">지점 목록 로딩 중...</div>}</div>

                  {selectedBranch && (
                    <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700 ring-1 ring-gray-200 sm:col-span-3">
                      <div className="font-medium text-gray-900">
                        {selectedBranch.center_name} · {selectedBranch.branch_name} ({selectedBranch.region_name})
                      </div>
                      <div className="mt-1 text-gray-600">{selectedBranch.address_detail}</div>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        <div>센터 연락처: {selectedBranch.center_phone || "-"}</div>
                        <div>담당자: {selectedBranch.manager_name || "-"}</div>
                        <div>담당자 연락처: {selectedBranch.manager_phone || "-"}</div>
                        <div>담당자 이메일: {selectedBranch.manager_email || "-"}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2) Class info */}
              <div className="grid gap-3 rounded-2xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-900">2) 강의 정보</div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-gray-600">강의 언어</label>
                    <select
                      value={reqLanguage}
                      onChange={(e) => setReqLanguage(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100">
                      {LANGUAGE_OPTIONS.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                    {reqLanguage === "Other" && (
                      <input
                        value={reqLanguageCustom}
                        onChange={(e) => setReqLanguageCustom(e.target.value)}
                        placeholder="예: French, German..."
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">강좌명</label>
                    <input
                      value={reqCourseTitle}
                      onChange={(e) => setReqCourseTitle(e.target.value)}
                      placeholder="예: 성인 영어 회화 (초급)"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  {/* ✅ NEW: Weekly timetable picker (요일+시간 선택) */}
                  <div className="sm:col-span-2">
                    <label className="text-sm text-gray-600">강의 요일 및 시간 (주간 타임테이블에서 선택)</label>
                    <div className="mt-2">
                      <WeeklyTimeTablePicker value={reqWeeklySlots} onChange={setReqWeeklySlots} errorText={reqScheduleError} />
                    </div>

                    {/* derived preview (read-only) */}
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700 ring-1 ring-gray-200">
                        <div className="text-xs font-semibold text-gray-600">선택 요일</div>
                        <div className="mt-1 font-medium text-gray-900">
                          {reqDays.length ? reqDays.map((k) => DAY_OPTIONS.find((d) => d.key === k)?.label ?? k).join(", ") : "-"}
                        </div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700 ring-1 ring-gray-200">
                        <div className="text-xs font-semibold text-gray-600">시작 시간</div>
                        <div className="mt-1 font-medium text-gray-900">{reqStartTime || "-"}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700 ring-1 ring-gray-200">
                        <div className="text-xs font-semibold text-gray-600">종료 시간</div>
                        <div className="mt-1 font-medium text-gray-900">{reqEndTime || "-"}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">시작일</label>
                    <input
                      type="date"
                      value={reqStartDate}
                      onChange={(e) => setReqStartDate(e.target.value)}
                      onBlur={() => {
                        if (!reqStartDate?.trim()) setReqStartDateError("수업 시작일을 선택해 주세요.");
                        else setReqStartDateError(null);
                      }}
                      aria-invalid={!!reqStartDateError}
                      className={clsx(
                        "mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:ring-4",
                        reqStartDateError
                          ? "border border-red-300 focus:border-red-400 focus:ring-red-100"
                          : "border border-gray-200 focus:border-gray-300 focus:ring-gray-100",
                      )}
                    />
                    {reqStartDateError && <div className="mt-1 text-xs font-medium text-red-600">{reqStartDateError}</div>}
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">종료일</label>
                    <input
                      type="date"
                      value={reqEndDate}
                      onChange={(e) => setReqEndDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">필요 강사 수</label>
                    <input
                      type="number"
                      min={1}
                      value={reqTeacherCount}
                      onChange={(e) => setReqTeacherCount(Number(e.target.value || 1))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">예상 수강생 수 (선택)</label>
                    <input
                      type="number"
                      min={0}
                      value={reqStudentsCount}
                      onChange={(e) => setReqStudentsCount(e.target.value)}
                      placeholder="예: 12"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-sm text-gray-600">추가 요청사항 (선택)</label>
                    <textarea
                      value={reqExtra}
                      onChange={(e) => setReqExtra(e.target.value)}
                      placeholder="예: 원어민 선호, 교재/교안 여부, 수업 대상(성인/아동), 레벨 등"
                      rows={4}
                      className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* 3) Applicant info */}
              <div className="grid gap-3 rounded-2xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-900">3) 신청자 정보</div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-gray-600">신청자 이름</label>
                    <input
                      value={reqApplicantName}
                      onChange={(e) => setReqApplicantName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">연락처</label>
                    <input
                      value={reqApplicantPhone}
                      onChange={(e) => setReqApplicantPhone(e.target.value)}
                      placeholder="예: 010-1234-5678"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-sm text-gray-600">이메일</label>
                    <input
                      type="email"
                      value={reqApplicantEmail}
                      onChange={(e) => setReqApplicantEmail(e.target.value)}
                      placeholder="예: manager@company.com"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 rounded-b-3xl border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => {
                  resetDispatchForm(defaultApplicantEmail || "");
                  onClose();
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 focus:outline-none">
                Cancel
              </button>

              <button
                type="button"
                onClick={submitDispatchRequest}
                disabled={reqSubmitting}
                className={clsx(
                  "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition focus:ring-4 focus:outline-none",
                  reqSubmitting ? "bg-gray-300 text-gray-700" : "bg-gray-900 text-white hover:bg-black focus:ring-gray-200",
                )}>
                {reqSubmitting ? "Submitting..." : "요청 제출"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
