"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import { coursesAPI, dispatchRequestsAPI } from "@/lib/api";

import PageShell from "@/components/cms/PageShell";
import StatusPill from "@/components/cms/StatusPill";
import DayBadges from "@/components/cms/DayBadges";

type CultureCenter = {
  id: number;
  center_name: string;
  region_name: string;
  branch_name: string;
  address_detail: string;
  center_phone?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
};

type DispatchRequest = {
  id: number;
  status: string;
  teaching_language: string;
  course_title: string;
  instructor_type?: string | null;

  class_days: string[];
  start_time?: string | null;
  end_time?: string | null;

  start_date: string;
  end_date?: string | null;
  lecture_count: number;

  applicant_name: string;
  applicant_phone: string;
  applicant_email: string;

  extra_requirements?: string | null;

  notes_for_teachers?: string | null;
  application_deadline?: string | null;
  published_at?: string | null;
  closed_at?: string | null;

  applications_count?: number;

  culture_center: CultureCenter;

  created_at: string;
  updated_at: string;
};

type CourseApplication = {
  id: number;
  dispatch_request: number;
  teacher: number;
  teacher_display: string;
  status: string;
  message?: string | null;
  created_at?: string | null;
};

function toHHmm(t?: string | null) {
  if (!t) return "-";
  const s = String(t).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  return s;
}

function fmtTimeRange(s?: string | null, e?: string | null) {
  const ss = toHHmm(s);
  const ee = toHHmm(e);
  if (!ss && !ee) return "-";
  if (ss && ee) return `${ss} ~ ${ee}`;
  return ss || ee || "-";
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const display = value === null || value === undefined || value === "" ? "-" : value;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="text-right text-sm font-medium text-zinc-900">{display}</div>
    </div>
  );
}

export default function DispatchRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  const [item, setItem] = useState<DispatchRequest | null>(null);
  const [apps, setApps] = useState<CourseApplication[]>([]);
  const [fetching, setFetching] = useState(true);

  const [notesDraft, setNotesDraft] = useState<string>("");
  const [deadlineDraft, setDeadlineDraft] = useState<string>("");
  const [savingMeta, setSavingMeta] = useState(false);

  const [openingPost, setOpeningPost] = useState(false);
  const [closingPost, setClosingPost] = useState(false);
  const [mutatingAppId, setMutatingAppId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const rid = useMemo(() => Number(id), [id]);

  const fetchAll = async () => {
    try {
      setFetching(true);
      const detailRes = isAdmin ? await dispatchRequestsAPI.adminDetail(rid) : await dispatchRequestsAPI.detail(rid);
      const data = detailRes.data as DispatchRequest;
      setItem(data);
      setNotesDraft(data?.notes_for_teachers || "");
      // datetime-local expects "YYYY-MM-DDTHH:mm"
      setDeadlineDraft(
        data?.application_deadline
          ? String(data.application_deadline).slice(0, 16).replace(" ", "T")
          : "",
      );

      if (isAdmin) {
        try {
          const appsRes = await dispatchRequestsAPI.applications(rid);
          const raw = (appsRes as any)?.data;
          const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
          const cleaned = list.filter((a) => {
            const td = String(a?.teacher_display ?? "").trim();
            const teacherOk = a?.teacher !== null && a?.teacher !== undefined && a?.teacher !== "";
            return teacherOk && td && td !== "-";
          });
          setApps(cleaned as CourseApplication[]);
        } catch {
          setApps([]);
        }
      }
    } catch (e: any) {
      toast.error("파견요청 상세를 불러오지 못했습니다.");
      router.push("/admin-pages/dispatch-requests");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  const saveMeta = async () => {
    if (!item) return;
    setSavingMeta(true);
    try {
      await dispatchRequestsAPI.adminUpdate(item.id, {
        notes_for_teachers: notesDraft,
        application_deadline: deadlineDraft || null,
      });
      toast.success("저장되었습니다.");
      fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "저장에 실패했습니다.";
      toast.error(msg);
    } finally {
      setSavingMeta(false);
    }
  };

  const openAndNotify = async () => {
    if (!item) return;
    const ok = window.confirm(
      "이 공고를 게시하고, 반경 15km 내 조건 일치 강사들에게 이메일을 자동 발송합니다. 계속하시겠습니까?",
    );
    if (!ok) return;

    setOpeningPost(true);
    try {
      // 먼저 메모/마감일 저장 (변경이 있을 수 있음)
      await dispatchRequestsAPI.adminUpdate(item.id, {
        notes_for_teachers: notesDraft,
        application_deadline: deadlineDraft || null,
      });
      await dispatchRequestsAPI.open(item.id);
      toast.success("공고가 게시되고 강사들에게 알림이 전송되었습니다.");
      fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "공고 게시에 실패했습니다.";
      toast.error(msg);
    } finally {
      setOpeningPost(false);
    }
  };

  const closePost = async () => {
    if (!item) return;
    const ok = window.confirm("이 공고를 마감하시겠습니까?");
    if (!ok) return;
    setClosingPost(true);
    try {
      await dispatchRequestsAPI.close(item.id);
      toast.success("공고가 마감되었습니다.");
      fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "마감에 실패했습니다.";
      toast.error(msg);
    } finally {
      setClosingPost(false);
    }
  };

  const setAppStatus = async (applicationId: number, status: string) => {
    if (!item) return;
    setMutatingAppId(applicationId);
    try {
      await dispatchRequestsAPI.setApplicationStatus(item.id, applicationId, status);
      toast.success("상태가 변경되었습니다.");
      fetchAll();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "상태 변경 실패";
      toast.error(msg);
    } finally {
      setMutatingAppId(null);
    }
  };

  const confirmCourse = async () => {
    if (!item) return;
    const selected = apps.find((a) => a.status === "SELECTED");
    if (!selected) {
      toast.error("먼저 SELECTED 상태의 강사를 지정하세요.");
      return;
    }
    const ok = window.confirm(
      `${selected.teacher_display} 강사로 강좌를 확정합니다. 선정자에는 축하 메일, 탈락자에는 결과 메일이 자동 발송됩니다. 계속하시겠습니까?`,
    );
    if (!ok) return;

    setConfirming(true);
    try {
      await coursesAPI.confirmFromDispatch(item.id, selected.teacher);
      toast.success("강좌가 확정되었습니다.");
      router.push("/admin-pages/courses");
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "강좌 확정에 실패했습니다.";
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  const cc = item?.culture_center;
  const selected = apps.find((a) => a.status === "SELECTED");
  const status = (item?.status || "").toUpperCase();
  const isRequested = status === "REQUESTED";
  const isOpen = status === "OPEN";
  const isClosed = status === "CLOSED";

  return (
    <PageShell
      title={item ? `파견요청 #${item.id}` : "파견요청"}
      subtitle={fetching ? "불러오는 중..." : "파견요청 상세 및 공고/지원자 관리"}
      backHref="/admin-pages/dispatch-requests"
      actions={
        <button
          onClick={fetchAll}
          className="inline-flex items-center rounded-2xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">
          새로고침
        </button>
      }>
      {!item ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">로딩 중...</div>
      ) : (
        <div className="mt-6 grid gap-4">
          {/* 요청 상세 */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-zinc-900">{item.course_title}</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {item.teaching_language}
                  {item.instructor_type ? ` · ${item.instructor_type}` : ""}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusPill value={item.status} />
                {typeof item.applications_count === "number" && (
                  <span className="text-xs text-zinc-500">지원 {item.applications_count}명</span>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-zinc-500">센터/지점</div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">
                  {cc?.center_name} / {cc?.branch_name}
                </div>
                <div className="mt-1 text-xs text-zinc-600">{cc?.region_name}</div>
                <div className="mt-1 text-xs text-zinc-600">{cc?.address_detail}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-500">일정</div>
                <div className="mt-1">
                  <DayBadges days={item.class_days} />
                </div>
                <div className="mt-2 text-sm text-zinc-900">{fmtTimeRange(item.start_time, item.end_time)}</div>
                <div className="mt-1 text-xs text-zinc-600">
                  시작일: {item.start_date || "-"} / 종료일: {item.end_date || "-"} / 횟수: {item.lecture_count ?? "-"}
                </div>
              </div>
            </div>
          </div>

          {/* 신청자 정보 */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">신청자 정보</div>
            <div className="mt-3 grid gap-2 text-sm text-zinc-900 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-zinc-500">이름</div>
                <div className="mt-1">{item.applicant_name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-500">연락처</div>
                <div className="mt-1">{item.applicant_phone}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs font-semibold text-zinc-500">이메일</div>
                <div className="mt-1">{item.applicant_email}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-zinc-500">추가 요청사항</div>
              <div className="mt-1 text-sm whitespace-pre-wrap text-zinc-900">{item.extra_requirements || "-"}</div>
            </div>
          </div>

          {/* 공고 관리 (관리자) */}
          {isAdmin && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">공고 관리</div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-zinc-600">지원 마감 (선택)</label>
                  <input
                    type="datetime-local"
                    value={deadlineDraft}
                    onChange={(e) => setDeadlineDraft(e.target.value)}
                    disabled={isClosed}
                    step={60}
                    className={clsx(
                      "mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm",
                      isClosed && "cursor-not-allowed bg-zinc-50 text-zinc-500",
                    )}
                  />
                  <p className="mt-1 text-xs text-zinc-500">예: 2026-05-01T18:00</p>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-zinc-600">강사 안내 메모</label>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    disabled={isClosed}
                    rows={3}
                    className={clsx(
                      "mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm",
                      isClosed && "cursor-not-allowed bg-zinc-50 text-zinc-500",
                    )}
                    placeholder="강사에게 전달할 공지/안내사항"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!isClosed && (
                  <button
                    onClick={saveMeta}
                    disabled={savingMeta}
                    className={clsx(
                      "inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50",
                      savingMeta && "cursor-not-allowed opacity-60",
                    )}>
                    {savingMeta ? "저장 중..." : "메모/마감일 저장"}
                  </button>
                )}

                {isRequested && (
                  <button
                    onClick={openAndNotify}
                    disabled={openingPost}
                    className={clsx(
                      "inline-flex items-center rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700",
                      openingPost && "cursor-not-allowed opacity-60",
                    )}>
                    {openingPost ? "게시 중..." : "공고 게시 & 강사 알림"}
                  </button>
                )}

                {isOpen && (
                  <button
                    onClick={closePost}
                    disabled={closingPost}
                    className={clsx(
                      "inline-flex items-center rounded-2xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-black",
                      closingPost && "cursor-not-allowed opacity-60",
                    )}>
                    {closingPost ? "마감 중..." : "공고 마감"}
                  </button>
                )}

                {isClosed && (
                  <Link
                    href="/admin-pages/courses"
                    className="inline-flex items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm hover:bg-emerald-100">
                    강좌 관리로 이동 →
                  </Link>
                )}
              </div>

              {(item.published_at || item.closed_at) && (
                <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                  {item.published_at && <div>게시일: {item.published_at}</div>}
                  {item.closed_at && <div>마감일: {item.closed_at}</div>}
                </div>
              )}
            </div>
          )}

          {/* 지원자 목록 (관리자, OPEN 이후만) */}
          {isAdmin && !isRequested && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">지원자</div>
                  <div className="mt-1 text-sm text-zinc-600">SELECTED 1명을 지정한 뒤, 강좌를 확정합니다.</div>
                </div>
                {selected && (
                  <button
                    onClick={confirmCourse}
                    disabled={confirming || isClosed}
                    className={clsx(
                      "inline-flex items-center rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700",
                      (confirming || isClosed) && "cursor-not-allowed opacity-60",
                    )}>
                    {confirming ? "확정 중..." : "강사 확정 (Course 생성)"}
                  </button>
                )}
              </div>

              {apps.length === 0 ? (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                  아직 지원자가 없습니다.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-700">강사</th>
                        <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-700">상태</th>
                        <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-xs font-semibold text-zinc-700">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apps.map((a) => {
                        const isBusy = mutatingAppId === a.id;
                        const isSelected = a.status === "SELECTED";
                        return (
                          <tr key={a.id} className={clsx(isSelected && "bg-emerald-50")}>
                            <td className="border-b border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-900">{a.teacher_display}</td>
                            <td className="border-b border-zinc-200 px-3 py-3 text-sm text-zinc-700">
                              <StatusPill value={a.status} />
                            </td>
                            <td className="border-b border-zinc-200 px-3 py-3 text-right">
                              <div className="inline-flex flex-wrap justify-end gap-2">
                                {!isSelected && !isClosed && (
                                  <button
                                    disabled={isBusy}
                                    onClick={() => setAppStatus(a.id, "SELECTED")}
                                    className={clsx(
                                      "inline-flex items-center rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700",
                                      isBusy && "cursor-not-allowed opacity-60",
                                    )}>
                                    선정
                                  </button>
                                )}
                                {isSelected && <span className="text-xs font-semibold text-emerald-700">선정됨</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
