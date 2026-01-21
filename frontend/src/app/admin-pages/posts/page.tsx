"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import { coursePostsAPI, dispatchRequestsAPI } from "@/lib/api";

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

function toOptionLabel(dr: DispatchRequest) {
  const cc = dr.culture_center;
  const place = cc ? `${cc.region_name}·${cc.center_name}·${cc.branch_name}` : "-";
  return `#${dr.id} | ${dr.course_title} | ${dr.teaching_language} | ${place} | ${dr.start_date}`;
}

export default function AdminPostsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<CoursePost[]>([]);
  const [dispatchRequests, setDispatchRequests] = useState<DispatchRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);

  const [dispatchRequestId, setDispatchRequestId] = useState<number | "">("");
  const [deadline, setDeadline] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

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
      const [postsRes, drRes] = await Promise.all([coursePostsAPI.adminList(), dispatchRequestsAPI.adminList()]);
      const postsData = Array.isArray(postsRes.data) ? postsRes.data : postsRes.data?.results || postsRes.data?.data || [];
      const drData = Array.isArray(drRes.data) ? drRes.data : drRes.data?.results || drRes.data?.data || [];
      setPosts(postsData);
      setDispatchRequests(drData);
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

  const drOptions = useMemo(() => {
    // 중복 생성은 백엔드가 막아주지만, UX를 위해 "이미 post가 있는 dr"는 목록에서 숨김
    const used = new Set(posts.map((p) => p.dispatch_request?.id).filter(Boolean));
    return dispatchRequests.filter((dr) => !used.has(dr.id));
  }, [dispatchRequests, posts]);

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
      title="공고 관리"
      subtitle="파견요청(DispatchRequest) 기반으로 공고를 생성/게시/마감하고 지원자를 관리합니다."
      backHref="/admin-pages"
      actions={actions}>
      <div className="space-y-3">
        {/* Create */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">공고 생성</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-600">파견요청 선택</label>
              <select
                value={dispatchRequestId}
                onChange={(e) => setDispatchRequestId(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
                <option value="">선택하세요</option>
                {drOptions.map((dr) => (
                  <option key={dr.id} value={dr.id}>
                    {toOptionLabel(dr)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">이미 공고가 생성된 파견요청은 목록에서 숨깁니다.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600">지원 마감(선택)</label>
              <input
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="YYYY-MM-DDTHH:mm" // ISO
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-zinc-500">예: 2026-02-01T18:00 (시간대는 서버 설정에 따름)</p>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-600">강사 안내(선택)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="강사에게 전달할 공지/안내사항"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              disabled={creating || dispatchRequestId === ""}
              onClick={async () => {
                if (dispatchRequestId === "") return;
                setCreating(true);
                try {
                  await coursePostsAPI.create({
                    dispatch_request_id: dispatchRequestId,
                    application_deadline: deadline ? deadline : null,
                    notes_for_teachers: notes || "",
                  });
                  toast.success("공고가 생성되었습니다. (DRAFT)");
                  setDispatchRequestId("");
                  setDeadline("");
                  setNotes("");
                  await refresh();
                } catch (e: any) {
                  const msg = e?.response?.data?.detail || e?.response?.data?.message || "공고 생성에 실패했습니다.";
                  toast.error(msg);
                } finally {
                  setCreating(false);
                }
              }}
              className={clsx(
                "inline-flex items-center rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700",
                (creating || dispatchRequestId === "") && "cursor-not-allowed opacity-60",
              )}>
              {creating ? "생성 중..." : "공고 생성"}
            </button>
          </div>
        </div>

        {/* List */}
        {fetching && <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">불러오는 중...</div>}

        {!fetching && posts.length === 0 && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold text-zinc-900">공고가 없습니다.</div>
            <div className="mt-1 text-sm text-zinc-600">위에서 파견요청을 선택해 공고를 생성해 주세요.</div>
          </div>
        )}

        {posts.map((p) => {
          const dr = p.dispatch_request;
          const cc = dr?.culture_center;
          const place = cc ? `${cc.region_name} · ${cc.center_name} · ${cc.branch_name}` : "-";
          const time = dr?.start_time && dr?.end_time ? `${dr.start_time} ~ ${dr.end_time}` : "-";

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
                    상세/지원자
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
                    게시
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
                    마감
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
                      <span className="text-sm font-medium text-zinc-900">{dr?.start_date || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">수업횟수</span>
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
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500">지원 마감</span>
                    <span className="text-sm font-medium text-zinc-900">{p.application_deadline || "-"}</span>
                  </div>
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
