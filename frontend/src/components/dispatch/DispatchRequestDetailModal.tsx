// frontend/src/components/dispatch/DispatchRequestDetailModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { toast } from "react-hot-toast";

import { coursePostsAPI, dispatchRequestsAPI } from "@/lib/api";
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

  created_at?: string;
  updated_at?: string;
};

type CoursePostSummary = {
  id: number;
  status: string;
};

type Props = {
  open: boolean;
  requestId: number | null;
  isAdmin: boolean;
  onClose: () => void;
  onPostCreated?: (postId?: number) => void;
};

function fmtTimeRange(s?: string | null, e?: string | null) {
  if (!s && !e) return "-";
  if (s && e) return `${s} ~ ${e}`;
  return s || e || "-";
}

export default function DispatchRequestDetailModal({ open, requestId, isAdmin, onClose, onPostCreated }: Props) {
  const [fetching, setFetching] = useState(false);
  const [item, setItem] = useState<DispatchRequestDetail | null>(null);

  const [relatedPost, setRelatedPost] = useState<CoursePostSummary | null>(null);
  const [relatedPostLoading, setRelatedPostLoading] = useState(false);

  const [creatingPost, setCreatingPost] = useState(false);
  const [deadline, setDeadline] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [createdPostId, setCreatedPostId] = useState<number | null>(null);

  const fetchRelatedPost = async (rid: number) => {
    if (!isAdmin) {
      setRelatedPost(null);
      return;
    }

    try {
      setRelatedPostLoading(true);
      const res = await coursePostsAPI.adminList({ dispatch_request_id: rid });
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length > 0) {
        setRelatedPost({ id: Number(list[0].id), status: String(list[0].status) });
        setCreatedPostId(Number(list[0].id)); // ✅ 링크 버튼에서 그대로 재사용
      } else {
        setRelatedPost(null);
      }
    } catch (e) {
      // 네트워크/권한 등: 조용히 무시(UX)
      setRelatedPost(null);
    } finally {
      setRelatedPostLoading(false);
    }
  };

  const fetchDetail = async (rid: number) => {
    try {
      setFetching(true);
      setCreatedPostId(null);
      setRelatedPost(null);

      const res = isAdmin ? await dispatchRequestsAPI.adminDetail(rid) : await dispatchRequestsAPI.detail(rid);
      setItem(res.data);
    } catch (e: any) {
      toast.error("파견요청 상세를 불러오지 못했습니다.");
      setItem(null);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!requestId) return;
    fetchDetail(requestId);
    fetchRelatedPost(requestId);
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
    if (!requestId) return "파견요청";
    return item ? `파견요청 #${item.id}` : `파견요청 #${requestId}`;
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
                <div className="mt-1 text-sm text-zinc-600">파견요청 상세 확인 및 공고 생성</div>
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
                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-bold text-zinc-900">{item.course_title}</div>
                        <div className="mt-1 text-sm text-zinc-600">
                          {item.teaching_language}
                          {item.instructor_type ? ` · ${item.instructor_type}` : ""}
                        </div>
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
                        <div className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                          <div>센터 연락처: {item.culture_center?.center_phone || "-"}</div>
                          <div>담당자: {item.culture_center?.manager_name || "-"}</div>
                          <div>담당자 연락처: {item.culture_center?.manager_phone || "-"}</div>
                          <div>담당자 이메일: {item.culture_center?.manager_email || "-"}</div>
                        </div>
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

                  {isAdmin ? (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">공고 생성</div>
                          <div className="mt-1 text-xs text-zinc-600">이 파견요청(#{item.id})을 기반으로 공고를 생성합니다.</div>

                          {relatedPostLoading ? (
                            <div className="mt-1 text-xs text-zinc-500">공고 존재 여부 확인 중...</div>
                          ) : relatedPost ? (
                            <div className="mt-1 text-xs text-zinc-600">
                              이미 공고가 존재합니다. (status: <span className="font-semibold">{relatedPost.status}</span>)
                            </div>
                          ) : null}
                        </div>

                        {createdPostId && (
                          <Link
                            href={`/admin-pages/posts/${createdPostId}`}
                            className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
                            {relatedPost ? "기존 공고 보기" : "생성된 공고 보기"}
                          </Link>
                        )}
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-zinc-600">지원 마감(선택)</label>
                          <input
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            placeholder="YYYY-MM-DDTHH:mm"
                            disabled={!!relatedPost}
                            className={clsx(
                              "mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm",
                              relatedPost && "cursor-not-allowed bg-zinc-50 text-zinc-500",
                            )}
                          />
                          <p className="mt-1 text-xs text-zinc-500">예: 2026-02-01T18:00 (시간대는 서버 설정에 따름)</p>
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-zinc-600">강사 안내(선택)</label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            disabled={!!relatedPost}
                            className={clsx(
                              "mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm",
                              relatedPost && "cursor-not-allowed bg-zinc-50 text-zinc-500",
                            )}
                            placeholder="강사에게 전달할 공지/안내사항"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          disabled={creatingPost || !!relatedPost || relatedPostLoading}
                          onClick={async () => {
                            if (!item) return;
                            if (relatedPost) {
                              toast("이미 공고가 존재합니다. 오른쪽 버튼으로 이동하세요.");
                              return;
                            }

                            setCreatingPost(true);
                            try {
                              const res = await coursePostsAPI.create({
                                dispatch_request_id: item.id,
                                application_deadline: deadline ? deadline : null,
                                notes_for_teachers: notes || "",
                              });
                              const newId = res?.data?.id ? Number(res.data.id) : null;
                              if (newId) setCreatedPostId(newId);
                              if (newId) setRelatedPost({ id: newId, status: String(res?.data?.status || "DRAFT") });
                              toast.success("공고가 생성되었습니다. (DRAFT)");
                              onPostCreated?.(newId || undefined);
                            } catch (e: any) {
                              const msg = e?.response?.data?.detail || e?.response?.data?.message || "공고 생성에 실패했습니다.";
                              toast.error(msg);
                            } finally {
                              setCreatingPost(false);
                            }
                          }}
                          className={clsx(
                            "inline-flex items-center rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700",
                            (creatingPost || !!relatedPost || relatedPostLoading) && "cursor-not-allowed opacity-60",
                          )}>
                          {creatingPost ? "생성 중..." : relatedPostLoading ? "확인 중..." : relatedPost ? "공고 존재" : "공고 생성"}
                        </button>

                        <button
                          onClick={() => {
                            setDeadline("");
                            setNotes("");
                            if (!relatedPost) setCreatedPostId(null);
                          }}
                          className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
                          입력 초기화
                        </button>
                      </div>

                      <div className="mt-3 text-xs text-zinc-500">* 공고 존재 여부는 서버에서 확인합니다. (CoursePost는 DispatchRequest와 1:1)</div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">공고 생성은 관리자만 가능합니다.</div>
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
