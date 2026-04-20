"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
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
  center_phone?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
};

type DispatchRequest = {
  id: number;
  culture_center: CultureCenter;
  status: string;
  teaching_language: string;
  course_title: string;
  instructor_type?: string | null;
  class_days: any;
  start_time?: string | null;
  end_time?: string | null;
  start_date: string;
  end_date?: string | null;
  lecture_count?: number | null;
  students_count?: number | null;
  extra_requirements?: string | null;
  application_deadline?: string | null;
  notes_for_teachers?: string | null;
  applications_count?: number;
};

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const display = value === null || value === undefined || value === "" ? "-" : value;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="text-right text-sm font-medium text-zinc-900">{display}</div>
    </div>
  );
}

export default function TeacherPostDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();

  const postId = useMemo(() => Number((params as any)?.id), [params]);

  const [post, setPost] = useState<DispatchRequest | null>(null);
  const [fetching, setFetching] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && user.role !== "teacher") {
      router.push("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "teacher" || !postId) return;
    let mounted = true;

    (async () => {
      setFetching(true);
      try {
        const res = await dispatchRequestsAPI.detail(postId);
        if (mounted) setPost(res.data);
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.response?.data?.message || "공고를 불러오지 못했습니다.";
        toast.error(msg);
      } finally {
        if (mounted) setFetching(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, postId, refreshKey]);

  const actions = (
    <>
      <Link
        href="/teacher/posts"
        className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
        공고 목록
      </Link>
      <button
        onClick={async () => {
          if (!post) return;
          const ok = window.confirm("이 공고에 지원하시겠습니까?");
          if (!ok) return;
          try {
            await dispatchRequestsAPI.apply(post.id);
            toast.success("지원이 완료되었습니다.");
            setRefreshKey((k) => k + 1);
          } catch (e: any) {
            const msg = e?.response?.data?.detail || e?.response?.data?.message || "지원에 실패했습니다.";
            toast.error(msg);
          }
        }}
        className="inline-flex items-center rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
        지원하기
      </button>
      <button
        onClick={async () => {
          if (!post) return;
          const ok = window.confirm("지원을 취소하시겠습니까?");
          if (!ok) return;
          try {
            await dispatchRequestsAPI.withdraw(post.id);
            toast.success("지원이 취소되었습니다.");
            setRefreshKey((k) => k + 1);
          } catch (e: any) {
            const msg = e?.response?.data?.detail || e?.response?.data?.message || "지원 취소에 실패했습니다.";
            toast.error(msg);
          }
        }}
        className={clsx(
          "inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50",
        )}>
        지원 취소
      </button>
    </>
  );

  const cc = post?.culture_center;
  const time = post?.start_time && post?.end_time ? `${post.start_time} ~ ${post.end_time}` : "-";

  return (
    <PageShell title="공고 상세" subtitle="지원 전 강좌 정보를 확인하세요." backHref="/teacher/posts" actions={actions}>
      {fetching && <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">불러오는 중...</div>}

      {!fetching && !post && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold text-zinc-900">공고를 찾을 수 없습니다.</div>
        </div>
      )}

      {post && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-zinc-900">{post.course_title || "(제목 없음)"}</div>
              <StatusPill value={post.status} />
              {typeof post.applications_count === "number" && <span className="text-xs text-zinc-500">지원 {post.applications_count}명</span>}
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              {cc ? `${cc.region_name} · ${cc.center_name} · ${cc.branch_name}` : "-"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">수업 정보</div>
              <div className="mt-3 space-y-2">
                <Field label="언어" value={post.teaching_language || "-"} />
                <Field label="요일" value={<DayBadges days={post.class_days} className="justify-end" />} />
                <Field label="시간" value={time} />
                <Field label="개강" value={post.start_date || "-"} />
                <Field label="종강" value={post.end_date || "-"} />
                <Field label="수업횟수" value={post.lecture_count ?? "-"} />
                <Field label="수강생" value={post.students_count ?? "-"} />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">센터/요청사항</div>
              <div className="mt-3 space-y-2">
                <Field label="주소" value={cc?.address_detail || "-"} />
                <Field label="센터 전화" value={cc?.center_phone || "-"} />
                <Field label="담당자" value={cc?.manager_name || "-"} />
                <Field label="담당자 연락" value={cc?.manager_phone || "-"} />
                <Field label="담당자 이메일" value={cc?.manager_email || "-"} />
                <Field label="마감" value={post.application_deadline || "-"} />
              </div>
            </div>
          </div>

          {post.extra_requirements?.trim() && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">추가 요청사항</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{post.extra_requirements}</div>
            </div>
          )}

          {post.notes_for_teachers?.trim() && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">안내</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{post.notes_for_teachers}</div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
