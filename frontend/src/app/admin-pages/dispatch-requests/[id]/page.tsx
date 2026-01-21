"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import { dispatchRequestsAPI } from "@/lib/api";

import PageShell from "@/components/cms/PageShell";
import StatusPill from "@/components/cms/StatusPill";
import DayBadges from "@/components/cms/DayBadges";

type CultureCenter = {
  id: number;
  center_name: string;
  region_name: string;
  branch_name: string;
  address_detail: string;
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

  culture_center: CultureCenter;

  created_at: string;
  updated_at: string;
};

function fmtTimeRange(s?: string | null, e?: string | null) {
  if (!s && !e) return "-";
  if (s && e) return `${s} ~ ${e}`;
  return s || e || "-";
}

export default function DispatchRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  const [item, setItem] = useState<DispatchRequest | null>(null);
  const [fetching, setFetching] = useState(true);

  const [saving, setSaving] = useState(false);
  const [nextStatus, setNextStatus] = useState<string>("");

  const fetchDetail = async () => {
    try {
      setFetching(true);
      const rid = Number(id);
      const res = isAdmin ? await dispatchRequestsAPI.adminDetail(rid) : await dispatchRequestsAPI.detail(rid);
      setItem(res.data);
      setNextStatus(res.data?.status || "");
    } catch (e: any) {
      toast.error("파견요청 상세를 불러오지 못했습니다.");
      router.push("/admin/dispatch-requests");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  const actions = useMemo(() => {
    if (!isAdmin || !item) return null;
    return (
      <div className="flex items-center gap-2">
        <select
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
          className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm">
          {["NEW", "IN_REVIEW", "MATCHED", "CONFIRMED", "CLOSED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          disabled={saving || nextStatus === item.status}
          onClick={async () => {
            try {
              setSaving(true);
              await dispatchRequestsAPI.adminUpdate(item.id, { status: nextStatus });
              toast.success("상태를 업데이트했습니다.");
              fetchDetail();
            } catch (e: any) {
              toast.error("상태 업데이트에 실패했습니다.");
            } finally {
              setSaving(false);
            }
          }}
          className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60">
          상태 저장
        </button>
      </div>
    );
  }, [isAdmin, item, nextStatus, saving]);

  return (
    <PageShell
      title={item ? `파견요청 #${item.id}` : "파견요청"}
      subtitle={fetching ? "불러오는 중..." : "파견요청 상세 정보를 확인합니다."}
      backHref="/admin/dispatch-requests"
      actions={actions}>
      {!item ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">로딩 중...</div>
      ) : (
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-zinc-900">{item.course_title}</div>
                <div className="mt-1 text-sm text-zinc-600">{item.teaching_language}</div>
              </div>
              <StatusPill value={item.status} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-zinc-500">센터/지점</div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">
                  {item.culture_center?.center_name} / {item.culture_center?.branch_name}
                </div>
                <div className="mt-1 text-xs text-zinc-600">{item.culture_center?.region_name}</div>
                <div className="mt-1 text-xs text-zinc-600">{item.culture_center?.address_detail}</div>
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
        </div>
      )}
    </PageShell>
  );
}
