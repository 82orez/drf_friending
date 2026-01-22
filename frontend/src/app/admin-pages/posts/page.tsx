"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import { coursePostsAPI } from "@/lib/api";

import PageShell from "@/components/cms/PageShell";
import StatusPill from "@/components/cms/StatusPill";
import DayBadges from "@/components/cms/DayBadges";

// ✅ "HH:mm:ss" 또는 "HH:mm" 형태를 "HH:mm" 으로 통일
function toHHmm(t?: string | null) {
  if (!t) return "-";
  const s = String(t).trim();
  // "09:30:00" -> "09:30", "09:30" -> "09:30"
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  return s;
}

type CultureCenter = {
  id: number;
  center_name: string;
  region_name: string;
  branch_name: string;
  address_detail: string;
};

type DispatchRequest = {
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
  status?: string | null;
};

type CoursePost = {
  id: number;
  dispatch_request: DispatchRequest;
  status: string;
  application_deadline?: string | null;
  published_at?: string | null;
  closed_at?: string | null;
  notes_for_teachers?: string | null;
  applications_count?: number;
};

export default function AdminPostsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<CoursePost[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && user.role === "teacher") {
      router.push("/");
    }
  }, [loading, user, router]);

  const refresh = async () => {
    setFetching(true);
    try {
      const postsRes = await coursePostsAPI.adminList();
      const postsData = Array.isArray(postsRes.data) ? postsRes.data : postsRes.data?.results || postsRes.data?.data || [];
      setPosts(postsData);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "데이터를 불러오지 못했습니다.";
      toast.error(msg);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!user || user.role === "teacher") return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const actions = (
    <>
      <Link
        href="/admin-pages/courses"
        className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
        강좌 관리
      </Link>
      <button
        onClick={refresh}
        className="inline-flex items-center rounded-2xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">
        새로고침
      </button>
    </>
  );

  return (
    <PageShell
      title="모집 공고 관리"
      subtitle="생성된 모집 공고 초안을 최종적으로 게시/마감하고 지원자를 관리합니다."
      backHref="/admin-pages"
      actions={actions}>
      <div className="space-y-3">
        {/* List */}
        {fetching && <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">불러오는 중...</div>}

        {!fetching && posts.length === 0 && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold text-zinc-900">모집 공고가 없습니다.</div>
            <div className="mt-1 text-sm text-zinc-600">강사 파견 요청 상세에서 모집 공고 초안을 생성해 주세요.</div>
          </div>
        )}

        {posts.map((p) => {
          const dr = p.dispatch_request;
          const cc = dr?.culture_center;
          const place = cc ? `${cc.region_name} · ${cc.center_name} · ${cc.branch_name}` : "-";
          const time = dr?.start_time && dr?.end_time ? `${toHHmm(dr.start_time)} ~ ${toHHmm(dr.end_time)}` : "-";

          return (
            <div key={p.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-semibold text-zinc-900">{dr?.course_title || "(제목 없음)"}</div>
                    <StatusPill value={p.status} />
                    {typeof p.applications_count === "number" && <span className="text-xs text-zinc-500">지원 {p.applications_count}명</span>}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">{place}</div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/admin-pages/posts/${p.id}`}
                    className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
                    모집 공고 상세 및 지원자 현황
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        await coursePostsAPI.publish(p.id);
                        toast.success("게시되었습니다.");
                        refresh();
                      } catch (e: any) {
                        const msg = e?.response?.data?.detail || e?.response?.data?.message || "게시 실패";
                        toast.error(msg);
                      }
                    }}
                    className={clsx(
                      "inline-flex items-center rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700",
                      p.status === "PUBLISHED" && "opacity-60",
                    )}>
                    게시하기
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await coursePostsAPI.close(p.id);
                        toast.success("마감되었습니다.");
                        refresh();
                      } catch (e: any) {
                        const msg = e?.response?.data?.detail || e?.response?.data?.message || "마감 실패";
                        toast.error(msg);
                      }
                    }}
                    className={clsx(
                      "inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50",
                      p.status === "CLOSED" && "opacity-60",
                    )}>
                    마감하기
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-700">수업 일정</div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">과목</span>
                      <span className="text-sm font-medium text-zinc-900">{dr?.teaching_language || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">요일</span>
                      <DayBadges days={dr?.class_days} className="justify-end" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">시간</span>
                      <span className="text-sm font-medium text-zinc-900">{time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">예상 개강일</span>
                      <span className="text-sm font-medium text-zinc-900">{dr?.start_date || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">예상 종강일</span>
                      <span className="text-sm font-medium text-zinc-900">{dr?.end_date || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">수업 횟수</span>
                      <span className="text-sm font-medium text-zinc-900">{dr?.lecture_count ?? "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-700">메모</div>
                  <div className="mt-2 text-sm text-zinc-700">
                    {p.notes_for_teachers?.trim() ? (
                      <div className="whitespace-pre-wrap">{p.notes_for_teachers}</div>
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </div>
                  {p.application_deadline && (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">모집 공고 마감일</span>
                      <span className="text-sm font-medium text-zinc-900">{p.application_deadline || "-"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={"mt-6 flex justify-center text-sm text-zinc-600"}>
        <Link href={"/"}>Back to Home</Link>
      </div>
    </PageShell>
  );
}
