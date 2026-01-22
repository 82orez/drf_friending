"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import { coursePostsAPI, coursesAPI } from "@/lib/api";

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
  dispatch_request: DispatchRequest;
  status: string;
  application_deadline?: string | null;
  published_at?: string | null;
  closed_at?: string | null;
  notes_for_teachers?: string | null;
  applications_count?: number;
};

type CourseApplication = {
  id: number;
  post: number;
  teacher: number;
  teacher_display: string;
  status: string;
  message?: string | null;
  created_at?: string | null;
};

const APPLICATION_STATUSES = ["APPLIED", "SHORTLISTED", "REJECTED", "SELECTED", "WITHDRAWN"] as const;

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const display = value === null || value === undefined || value === "" ? "-" : value;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="text-right text-sm font-medium text-zinc-900">{display}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
      {children}
    </span>
  );
}

export default function AdminPostDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();

  const postId = useMemo(() => Number((params as any)?.id), [params]);

  const [post, setPost] = useState<CoursePost | null>(null);
  const [apps, setApps] = useState<CourseApplication[]>([]);
  const [fetching, setFetching] = useState(true);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && user.role === "teacher") router.push("/");
  }, [loading, user, router]);

  const refresh = async () => {
    if (!postId) return;
    setFetching(true);
    try {
      const [postRes, appRes] = await Promise.all([coursePostsAPI.adminDetail(postId), coursePostsAPI.applications(postId)]);
      const postData = postRes.data as CoursePost;
      setPost(postData);

      // DRF pagination 대비: [..] 또는 { results: [..] } 또는 { data: [..] }
      const raw = (appRes as any)?.data;
      const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : Array.isArray(raw?.data) ? raw.data : [];

      // ✅ "지원자 없음" 케이스에서 placeholder row가 섞여 들어오는 경우가 있어 방어적으로 필터링
      // - teacher가 없거나
      // - teacher_display가 비어있거나 '-' 인 항목은 실제 지원자로 보지 않음
      const cleaned = list.filter((a) => {
        const td = String(a?.teacher_display ?? "").trim();
        const teacherOk = a?.teacher !== null && a?.teacher !== undefined && a?.teacher !== "";
        return teacherOk && td && td !== "-";
      });

      // ✅ 백엔드에서 applications_count=0 이면 프론트에서도 무조건 비어있는 상태로 처리
      if (typeof postData?.applications_count === "number" && postData.applications_count === 0) {
        setApps([]);
      } else {
        setApps(cleaned as CourseApplication[]);
      }
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
  }, [user, postId]);

  const selected = apps.find((a) => a.status === "SELECTED");

  // ✅ 지원자 카드 렌더 여부는 "실제 지원 리스트" 기준
  const hasApplicants = apps.length > 0;

  // ✅ 상단 요약 배지(지원자 없음)는 "count 우선" + 없으면 apps 길이로 추정
  const applicantsCount = typeof post?.applications_count === "number" ? post.applications_count : hasApplicants ? apps.length : 0;

  const showNoApplicantsBadge = applicantsCount === 0;

  const actions = (
    <>
      <Link
        href="/admin-pages/posts"
        className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
        공고 목록
      </Link>
      <button
        onClick={refresh}
        className="inline-flex items-center rounded-2xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">
        새로고침
      </button>
      <button
        disabled={!selected || confirming}
        onClick={async () => {
          if (!selected || !post) return;
          setConfirming(true);
          try {
            await coursesAPI.confirmFromPost(post.id, selected.teacher);
            toast.success("강좌가 확정(생성)되었습니다.");
            router.push("/admin/courses");
          } catch (e: any) {
            const msg = e?.response?.data?.detail || e?.response?.data?.message || "강좌 확정에 실패했습니다.";
            toast.error(msg);
          } finally {
            setConfirming(false);
          }
        }}
        className={clsx(
          "inline-flex items-center rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700",
          (!selected || confirming) && "cursor-not-allowed opacity-60",
        )}>
        {confirming ? "확정 중..." : "선정 강사로 강좌 확정"}
      </button>
    </>
  );

  const dr = post?.dispatch_request;
  const cc = dr?.culture_center;
  const time = dr?.start_time && dr?.end_time ? `${dr.start_time} ~ ${dr.end_time}` : "-";

  return (
    <PageShell
      title="공고 상세/지원자"
      subtitle="지원자 상태를 관리하고 선정된 강사로 강좌를 확정하세요."
      backHref="/admin-pages/posts"
      actions={actions}>
      {fetching && <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">불러오는 중...</div>}

      {!fetching && !post && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold text-zinc-900">공고를 찾을 수 없습니다.</div>
        </div>
      )}

      {post && (
        <div className="space-y-3">
          {/* Post summary */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-zinc-900">{dr?.course_title || "(제목 없음)"}</div>

              <StatusPill value={post.status} />

              {/* ✅ 지원자 수 / 지원자 없음 배지 */}
              {typeof post.applications_count === "number" ? (
                <span className="text-xs text-zinc-500">지원 {post.applications_count}명</span>
              ) : (
                <span className="text-xs text-zinc-500">지원 {apps.length}명</span>
              )}

              {showNoApplicantsBadge && <Badge>지원자 없음</Badge>}
            </div>

            <div className="mt-1 text-sm text-zinc-600">{cc ? `${cc.region_name} · ${cc.center_name} · ${cc.branch_name}` : "-"}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">수업 정보</div>
              <div className="mt-3 space-y-2">
                <Field label="언어" value={dr?.teaching_language || "-"} />
                <Field label="요일" value={<DayBadges days={dr?.class_days} className="justify-end" />} />
                <Field label="시간" value={time} />
                <Field label="개강" value={dr?.start_date || "-"} />
                <Field label="종강" value={dr?.end_date || "-"} />
                <Field label="수업횟수" value={dr?.lecture_count ?? "-"} />
                <Field label="마감" value={post.application_deadline || "-"} />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">센터 정보</div>
              <div className="mt-3 space-y-2">
                <Field label="주소" value={cc?.address_detail || "-"} />
                <Field label="센터 전화" value={cc?.center_phone || "-"} />
                <Field label="담당자" value={cc?.manager_name || "-"} />
                <Field label="담당자 연락" value={cc?.manager_phone || "-"} />
                <Field label="담당자 이메일" value={cc?.manager_email || "-"} />
              </div>
            </div>
          </div>

          {post.notes_for_teachers?.trim() && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">강사 안내</div>
              <div className="mt-2 text-sm whitespace-pre-wrap text-zinc-700">{post.notes_for_teachers}</div>
            </div>
          )}

          {dr?.extra_requirements?.trim() && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">추가 요청사항</div>
              <div className="mt-2 text-sm whitespace-pre-wrap text-zinc-700">{dr.extra_requirements}</div>
            </div>
          )}

          {/* Applications (지원자 0명일 때는 카드 자체를 숨김) */}
          {hasApplicants && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">지원자</div>
                  <div className="mt-1 text-sm text-zinc-600">상태를 변경하고, SELECTED 1명을 기준으로 강좌를 확정합니다.</div>
                </div>
                {selected && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    선정됨: <span className="font-semibold">{selected.teacher_display}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap text-zinc-700">
                        강사
                      </th>
                      <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap text-zinc-700">
                        메시지
                      </th>
                      <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap text-zinc-700">
                        상태
                      </th>
                      <th className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-xs font-semibold whitespace-nowrap text-zinc-700">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((a) => {
                      const isBusy = mutatingId === a.id;
                      const isSelected = a.status === "SELECTED";
                      return (
                        <tr key={a.id} className={clsx(isSelected && "bg-emerald-50")}>
                          <td className="border-b border-zinc-200 px-3 py-3 text-sm font-medium text-zinc-900">{a.teacher_display}</td>
                          <td className="border-b border-zinc-200 px-3 py-3 text-sm text-zinc-700">
                            <div className="max-w-[480px] whitespace-pre-wrap">
                              {a.message?.trim() ? a.message : <span className="text-zinc-500">-</span>}
                            </div>
                          </td>
                          <td className="border-b border-zinc-200 px-3 py-3">
                            <select
                              value={a.status}
                              onChange={async (e) => {
                                const next = e.target.value;
                                setMutatingId(a.id);
                                try {
                                  await coursePostsAPI.setApplicationStatus(postId, a.id, next);
                                  toast.success("상태가 변경되었습니다.");
                                  await refresh();
                                } catch (err: any) {
                                  const msg = err?.response?.data?.detail || err?.response?.data?.message || "상태 변경 실패";
                                  toast.error(msg);
                                } finally {
                                  setMutatingId(null);
                                }
                              }}
                              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                              disabled={isBusy}>
                              {APPLICATION_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border-b border-zinc-200 px-3 py-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-2">
                              <button
                                disabled={isBusy}
                                onClick={async () => {
                                  setMutatingId(a.id);
                                  try {
                                    await coursePostsAPI.setApplicationStatus(postId, a.id, "SHORTLISTED");
                                    toast.success("SHORTLISTED로 변경");
                                    await refresh();
                                  } catch (err: any) {
                                    const msg = err?.response?.data?.detail || err?.response?.data?.message || "실패";
                                    toast.error(msg);
                                  } finally {
                                    setMutatingId(null);
                                  }
                                }}
                                className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50">
                                후보
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={async () => {
                                  setMutatingId(a.id);
                                  try {
                                    await coursePostsAPI.setApplicationStatus(postId, a.id, "REJECTED");
                                    toast.success("REJECTED로 변경");
                                    await refresh();
                                  } catch (err: any) {
                                    const msg = err?.response?.data?.detail || err?.response?.data?.message || "실패";
                                    toast.error(msg);
                                  } finally {
                                    setMutatingId(null);
                                  }
                                }}
                                className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50">
                                탈락
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={async () => {
                                  setMutatingId(a.id);
                                  try {
                                    await coursePostsAPI.setApplicationStatus(postId, a.id, "SELECTED");
                                    toast.success("SELECTED로 변경");
                                    await refresh();
                                  } catch (err: any) {
                                    const msg = err?.response?.data?.detail || err?.response?.data?.message || "실패";
                                    toast.error(msg);
                                  } finally {
                                    setMutatingId(null);
                                  }
                                }}
                                className={clsx(
                                  "inline-flex items-center rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700",
                                  isSelected && "opacity-70",
                                )}>
                                선정
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
