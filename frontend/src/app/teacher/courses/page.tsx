"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import { coursesAPI } from "@/lib/api";

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
  notes?: string | null;
};

type Course = {
  id: number;
  status: string;
  course_title: string;
  teaching_language: string;
  culture_center: CultureCenter;
  class_days: any;
  start_time?: string | null;
  end_time?: string | null;
  start_date: string;
  end_date?: string | null;
  lecture_count?: number | null;
};

export default function TeacherCoursesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [fetching, setFetching] = useState(true);

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
        const res = await coursesAPI.myList();
        const data = Array.isArray(res.data) ? res.data : res.data?.results || res.data?.data || [];
        if (mounted) setCourses(data);
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.response?.data?.message || "강좌 목록을 불러오지 못했습니다.";
        toast.error(msg);
      } finally {
        if (mounted) setFetching(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  const actions = (
    <>
      <Link
        href="/teacher/posts"
        className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
        공고 보기
      </Link>
      <Link
        href="/teacher/application"
        className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
        이력서
      </Link>
    </>
  );

  return (
    <PageShell title="내 강좌" subtitle="배정(확정)된 강좌를 확인하세요." backHref="/" actions={actions}>
      <div className="space-y-3">
        {fetching && <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">불러오는 중...</div>}

        {!fetching && courses.length === 0 && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold text-zinc-900">아직 배정된 강좌가 없습니다.</div>
            <div className="mt-1 text-sm text-zinc-600">공고에 지원하면 배정될 수 있어요.</div>
            <div className="mt-4">
              <Link href="/teacher/posts" className="inline-flex items-center rounded-2xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">
                공고 보러가기
              </Link>
            </div>
          </div>
        )}

        {courses.map((c) => {
          const cc = c.culture_center;
          const place = cc ? `${cc.region_name} · ${cc.center_name} · ${cc.branch_name}` : "-";
          const time = c.start_time && c.end_time ? `${c.start_time} ~ ${c.end_time}` : "-";

          return (
            <div key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-semibold text-zinc-900">{c.course_title}</div>
                    <StatusPill value={c.status} />
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">{place}</div>
                </div>
                <div className="text-sm font-medium text-zinc-900">{c.teaching_language}</div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-700">수업 일정</div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">요일</span>
                      <DayBadges days={c.class_days} className="justify-end" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">시간</span>
                      <span className="text-sm font-medium text-zinc-900">{time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">개강</span>
                      <span className="text-sm font-medium text-zinc-900">{c.start_date || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">종강</span>
                      <span className="text-sm font-medium text-zinc-900">{c.end_date || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-700">기타</div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">수업횟수</span>
                      <span className="text-sm font-medium text-zinc-900">{c.lecture_count ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">주소</span>
                      <span className="max-w-[60%] truncate text-right text-sm font-medium text-zinc-900">{cc?.address_detail || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
