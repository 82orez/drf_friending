"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { dispatchRequestsAPI } from "@/lib/api";
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

export type DispatchRequestDetail = {
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

  culture_center: CultureCenter;

  notes_for_teachers?: string | null;
  application_deadline?: string | null;
  published_at?: string | null;
  closed_at?: string | null;

  created_at?: string;
  updated_at?: string;
};

type Props = {
  open: boolean;
  requestId: number | null;
  isAdmin: boolean;
  onClose: () => void;
  onPostCreated?: (postId?: number) => void;
};

function toHHMM(t?: string | null) {
  if (!t) return null;
  const s = String(t).trim();
  if (s.length >= 5 && s[2] === ":") return s.slice(0, 5);
  const parts = s.split(":");
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, "0");
    const mm = parts[1].padStart(2, "0");
    return `${hh}:${mm}`.slice(0, 5);
  }
  return s;
}

function fmtTimeRange(s?: string | null, e?: string | null) {
  const ss = toHHMM(s);
  const ee = toHHMM(e);
  if (!ss && !ee) return "-";
  if (ss && ee) return `${ss} ~ ${ee}`;
  return ss || ee || "-";
}

export default function DispatchRequestDetailModal({ open, requestId, isAdmin, onClose }: Props) {
  const router = useRouter();

  const [fetching, setFetching] = useState(false);
  const [item, setItem] = useState<DispatchRequestDetail | null>(null);

  const fetchDetail = async (rid: number) => {
    try {
      setFetching(true);
      const res = isAdmin ? await dispatchRequestsAPI.adminDetail(rid) : await dispatchRequestsAPI.detail(rid);
      setItem(res.data);
    } catch {
      toast.error("강사 파견 요청 상세를 불러오지 못했습니다.");
      setItem(null);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!requestId) return;
    fetchDetail(requestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requestId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const headerTitle = useMemo(() => {
    if (!requestId) return "강사 파견 요청";
    return item ? `강사 파견 요청 #${item.id}` : `강사 파견 요청 #${requestId}`;
  }, [item, requestId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      <div
        className="absolute inset-0 overflow-y-auto"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}>
        <div className="mx-auto flex min-h-full max-w-4xl items-center px-4 py-10 sm:px-6">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full rounded-3xl border border-zinc-200 bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 rounded-t-3xl border-b border-zinc-200 bg-zinc-50 px-5 py-5 sm:px-6">
              <div>
                <div className="text-base font-semibold text-zinc-900">{headerTitle}</div>
                <div className="mt-1 text-sm text-zinc-600">강사 파견 요청 상세 보기</div>
              </div>

              <button
                onClick={onClose}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus:ring-4 focus:ring-zinc-100 focus:outline-none">
                Close (Esc)
              </button>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              {fetching && <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">불러오는 중...</div>}

              {!fetching && !item && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">상세 정보를 불러오지 못했습니다.</div>
              )}

              {item && (
                <>
                  {/* Detail */}
                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-bold text-zinc-900">
                          {item.culture_center?.center_name} / {item.culture_center?.branch_name} ({item.culture_center?.region_name})
                        </div>
                        <div className="mt-1 text-sm text-zinc-600">
                          {item.teaching_language}
                          {item.instructor_type ? ` · ${item.instructor_type}` : ""}
                          {item.course_title ? ` · ${item.course_title}` : ""}
                        </div>
                      </div>
                      <StatusPill value={item.status} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">센터/지점 정보</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-500">
                          {item.culture_center?.center_name} / {item.culture_center?.branch_name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">{item.culture_center?.address_detail}</div>
                        <div className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                          <div>센터 연락처: {item.culture_center?.center_phone || "-"}</div>
                          <div>담당자: {item.culture_center?.manager_name || "-"}</div>
                          <div>담당자 연락처: {item.culture_center?.manager_phone || "-"}</div>
                          <div>담당자 이메일: {item.culture_center?.manager_email || "-"}</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-zinc-900">일정</div>
                        <div className="mt-1">
                          <DayBadges days={item.class_days} />
                        </div>
                        <div className="mt-2 text-sm text-zinc-900">{fmtTimeRange(item.start_time, item.end_time)}</div>
                        <div className="mt-1 text-sm text-zinc-600">
                          시작일: {item.start_date || "-"} / 종료일: {item.end_date || "-"} / 횟수: {item.lecture_count ?? "-"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Applicant */}
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

                  {/* 관리자 전용: 상세 페이지로 이동 */}
                  {isAdmin && (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">공고 관리</div>
                          <div className="mt-1 text-xs text-zinc-600">
                            공고 게시 / 지원자 관리 / 강좌 확정은 상세 페이지에서 진행합니다.
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            router.push(`/admin-pages/dispatch-requests/${item.id}`);
                            onClose();
                          }}
                          className="inline-flex items-center rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
                          상세 페이지로 이동
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
