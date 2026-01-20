"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import { coursePostsAPI } from "@/lib/api";

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
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
};

type DispatchRequestSummary = {
  id: number;
  culture_center: CultureCenter;
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
};

type CoursePost = {
  id: number;
  dispatch_request: DispatchRequestSummary;
  status: string;
  application_deadline?: string | null;
  published_at?: string | null;
  closed_at?: string | null;
  notes_for_teachers?: string | null;
  applications_count?: number;
};

function fmtDate(s?: string | null) {
  if (!s) return "-";
  return s;
}

export default function TeacherPostsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<CoursePost[]>([]);
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
    if (!user || user.role !== "teacher") return;
    let mounted = true;

    (async () => {
      setFetching(true);
      try {
        const res = await coursePostsAPI.list();
        const data = Array.isArray(res.data) ? res.data : res.data?.results || res.data?.data || [];
        if (mounted) setPosts(data);
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.response?.data?.message || "공고 목록을 불러오지 못했습니다.";
        toast.error(msg);
      } finally {
        if (mounted) setFetching(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, refreshKey]);

  const actions = (
    <>
      <Link
        href="/teacher/courses"
        className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
        내 강좌
      </Link>
      <Link
        href="/teacher/application"
        className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
        이력서
      </Link>
      <button
        onClick={() => setRefreshKey((k) => k + 1)}
        className="inline-flex items-center rounded-2xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">
        새로고침
      </button>
    </>
  );

  const empty = !fetching && posts.length === 0;

  return (
    <PageShell title="모집 공고" subtitle="현재 지원 가능한 문화센터 강좌 공고를 확인하고 지원하세요." backHref="/" actions={actions}>
      <div className="space-y-3">
        {fetching && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">불러오는 중...</div>
        )}

        {empty && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold text-zinc-900">현재 게시된 공고가 없습니다.</div>
            <div className="mt-1 text-sm text-zinc-600">나중에 다시 확인해 주세요.</div>
          </div>
        )}

        {posts.map((p) => {
          const dr = p.dispatch_request;
          const cc = dr?.culture_center;
          const title = dr?.course_title || "(제목 없음)";
          const place = cc ? `${cc.region_name} · ${cc.center_name} · ${cc.branch_name}` : "-";
          const time = dr?.start_time && dr?.end_time ? `${dr.start_time} ~ ${dr.end_time}` : "-";

          return (
            <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-zinc-900">{title}</h2>
                    <StatusPill value={p.status} />
                    {typeof p.applications_count === "number" && (
                      <span className="text-xs text-zinc-500">지원 {p.applications_count}명</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">{place}</div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/teacher/posts/${p.id}`}
                    className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
                    상세
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        await coursePostsAPI.apply(p.id);
                        toast.success("지원이 완료되었습니다.");
                        setRefreshKey((k) => k + 1);
                      } catch (e: any) {
                        const msg = e?.response?.data?.detail || e?.response?.data?.message || "지원에 실패했습니다.";
                        toast.error(msg);
                      }
                    }}
                    className={clsx(
                      "inline-flex items-center rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                    )}>
                    지원하기
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-700">수업 일정</div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">요일</span>
                      <DayBadges days={dr?.class_days} className="justify-end" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">시간</span>
                      <span className="text-sm font-medium text-zinc-900">{time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">개강</span>
                      <span className="text-sm font-medium text-zinc-900">{fmtDate(dr?.start_date)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">종강</span>
                      <span className="text-sm font-medium text-zinc-900">{fmtDate(dr?.end_date)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-700">조건</div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">언어</span>
                      <span className="text-sm font-medium text-zinc-900">{dr?.teaching_language || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">수업횟수</span>
                      <span className="text-sm font-medium text-zinc-900">{dr?.lecture_count ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">마감</span>
                      <span className="text-sm font-medium text-zinc-900">{p.application_deadline ? p.application_deadline : "-"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {p.notes_for_teachers?.trim() && (
                <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="text-xs font-semibold text-zinc-700">안내</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{p.notes_for_teachers}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
