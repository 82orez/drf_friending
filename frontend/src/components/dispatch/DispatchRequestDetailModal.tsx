// frontend/src/components/dispatch/DispatchRequestDetailModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

function toHHMM(t?: string | null) {
  if (!t) return null;

  // "HH:MM" or "HH:MM:SS" or "HH:MM:SS.sss" 같은 형태 모두 처리
  const s = String(t).trim();
  if (s.length >= 5 && s[2] === ":") return s.slice(0, 5);

  // 혹시 "H:MM" 같이 올 가능성까지 대비 (거의 없지만 안전하게)
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

function normalizeStatus(v?: string | null) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

type FieldErrors = Record<string, string[]>;

function toArrayMessage(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") return [v];
  return [String(v)];
}

function extractFieldErrors(err: any): { fieldErrors: FieldErrors; topMessage?: string } {
  const data = err?.response?.data;

  // DRF: {detail: "..."}
  if (data && typeof data === "object" && typeof data.detail === "string") {
    return { fieldErrors: {}, topMessage: data.detail };
  }

  // DRF validation: { field: ["..."], non_field_errors: ["..."] }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const fe: FieldErrors = {};
    let top = "";

    for (const k of Object.keys(data)) {
      const msgs = toArrayMessage((data as any)[k]);
      if (!msgs.length) continue;

      fe[k] = msgs;

      if (!top) {
        top = msgs[0];
      }
    }

    // message 라는 키가 오는 경우도 대비
    if (!top && typeof (data as any).message === "string") top = (data as any).message;

    return { fieldErrors: fe, topMessage: top || undefined };
  }

  // fallback
  const fallback = err?.response?.data?.message || err?.message || "요청 처리 중 오류가 발생했습니다.";

  return { fieldErrors: {}, topMessage: String(fallback) };
}

export default function DispatchRequestDetailModal({ open, requestId, isAdmin, onClose, onPostCreated }: Props) {
  const router = useRouter();

  const [fetching, setFetching] = useState(false);
  const [item, setItem] = useState<DispatchRequestDetail | null>(null);

  const [relatedPost, setRelatedPost] = useState<CoursePostSummary | null>(null);
  const [relatedPostLoading, setRelatedPostLoading] = useState(false);

  const [creatingPost, setCreatingPost] = useState(false);
  const [deadline, setDeadline] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [createdPostId, setCreatedPostId] = useState<number | null>(null);

  const [postActionLoading, setPostActionLoading] = useState<"publish" | "close" | null>(null);

  // ✅ inline error states
  const [topError, setTopError] = useState<string>("");
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});

  const clearErrors = () => {
    setTopError("");
    setCreateErrors({});
  };

  const gotoPostAndClose = (postId: number) => {
    // ✅ 모집 공고 목록 페이지로 이동 + 모달 닫기
    router.push(`/admin-pages/posts`);
    onClose();
  };

  const fetchRelatedPost = async (rid: number) => {
    if (!isAdmin) {
      setRelatedPost(null);
      setCreatedPostId(null);
      return;
    }

    try {
      setRelatedPostLoading(true);

      // ✅ 서버에 필터 요청
      const res = await coursePostsAPI.adminList({ dispatch_request_id: rid });

      // DRF pagination 대비: [..] 또는 { results: [..] } 모두 대응
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];

      // ✅ 혹시 서버 필터가 아직 미적용이어도 안전하게 한번 더 클라이언트에서 매칭
      const matched = list.find((p: any) => Number(p?.dispatch_request?.id) === rid);

      if (matched) {
        const pid = Number(matched.id);
        const pst = String(matched.status);
        setRelatedPost({ id: pid, status: pst });
        setCreatedPostId(pid);
      } else {
        setRelatedPost(null);
        setCreatedPostId(null);
      }
    } catch {
      setRelatedPost(null);
      setCreatedPostId(null);
    } finally {
      setRelatedPostLoading(false);
    }
  };

  const fetchDetail = async (rid: number) => {
    try {
      setFetching(true);
      setCreatedPostId(null);
      setRelatedPost(null);
      clearErrors();

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
    if (!requestId) return "강사 파견 요청";
    return item ? `강사 파견 요청 #${item.id}` : `강사 파견 요청 #${requestId}`;
  }, [item, requestId]);

  const relatedPostStatus = normalizeStatus(relatedPost?.status);
  const canPublish = !!relatedPost && relatedPostStatus === "DRAFT";
  const canClose = !!relatedPost && relatedPostStatus === "PUBLISHED";

  const deadlineErr = createErrors["application_deadline"] || createErrors["deadline"] || createErrors["applicationDeadline"] || [];
  const notesErr = createErrors["notes_for_teachers"] || createErrors["notes"] || createErrors["notesForTeachers"] || [];

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
                <div className="mt-1 text-sm text-zinc-600">강사 파견 요청 상세 및 모집 공고 생성/관리</div>
              </div>

              <button
                onClick={onClose}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus:ring-4 focus:ring-zinc-100 focus:outline-none">
                Close (Esc)
              </button>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              {topError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{topError}</div> : null}

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

                  {/* Create / Manage Post */}
                  {isAdmin ? (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">모집 공고 생성 / 관리</div>
                          <div className="mt-1 text-xs text-zinc-600">이 강사 파견 요청(#{item.id})을 기반으로 모집 공고를 생성/게시/마감합니다.</div>

                          {relatedPostLoading ? (
                            <div className="mt-1 text-xs text-zinc-500">모집 공고 존재 여부 확인 중...</div>
                          ) : relatedPost ? (
                            <div className="mt-1 text-xs text-zinc-600">
                              이미 모집 공고가 존재합니다. (status: <span className="font-semibold">{relatedPost.status}</span>)
                            </div>
                          ) : null}
                        </div>

                        {createdPostId && (
                          <Link
                            href={`/admin-pages/posts/${createdPostId}`}
                            className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
                            {relatedPost ? "모집 공고 내용 보기" : "생성된 모집 공고 보기"}
                          </Link>
                        )}
                      </div>

                      {/* existing post-actions */}
                      {relatedPost && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {canPublish && (
                            <button
                              disabled={postActionLoading !== null}
                              onClick={async () => {
                                if (!relatedPost) return;
                                clearErrors();
                                setPostActionLoading("publish");
                                try {
                                  const res = await coursePostsAPI.publish(relatedPost.id);
                                  const newStatus = res?.data?.status ? String(res.data.status) : "PUBLISHED";
                                  setRelatedPost({ id: relatedPost.id, status: newStatus });
                                  toast.success("모집 공고가 게시되었습니다. (PUBLISHED)");
                                  onPostCreated?.(relatedPost.id);
                                  gotoPostAndClose(relatedPost.id);
                                } catch (e: any) {
                                  const { topMessage } = extractFieldErrors(e);
                                  setTopError(topMessage || "모집 공고 게시(publish)에 실패했습니다.");
                                  toast.error(topMessage || "모집 공고 게시(publish)에 실패했습니다.");
                                } finally {
                                  setPostActionLoading(null);
                                }
                              }}
                              className={clsx(
                                "inline-flex items-center rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700",
                                postActionLoading && "cursor-not-allowed opacity-60",
                              )}>
                              {postActionLoading === "publish" ? "게시 중..." : "게시(Publish) → 상세로 이동"}
                            </button>
                          )}

                          {canClose && (
                            <button
                              disabled={postActionLoading !== null}
                              onClick={async () => {
                                if (!relatedPost) return;
                                clearErrors();
                                setPostActionLoading("close");
                                try {
                                  const res = await coursePostsAPI.close(relatedPost.id);
                                  const newStatus = res?.data?.status ? String(res.data.status) : "CLOSED";
                                  setRelatedPost({ id: relatedPost.id, status: newStatus });
                                  toast.success("모집 공고가 마감되었습니다. (CLOSED)");
                                  onPostCreated?.(relatedPost.id);
                                  gotoPostAndClose(relatedPost.id);
                                } catch (e: any) {
                                  const { topMessage } = extractFieldErrors(e);
                                  setTopError(topMessage || "모집 공고 마감(close)에 실패했습니다.");
                                  toast.error(topMessage || "모집 공고 마감(close)에 실패했습니다.");
                                } finally {
                                  setPostActionLoading(null);
                                }
                              }}
                              className={clsx(
                                "inline-flex items-center rounded-2xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-black",
                                postActionLoading && "cursor-not-allowed opacity-60",
                              )}>
                              {postActionLoading === "close" ? "마감 중..." : "마감(Close) → 상세로 이동"}
                            </button>
                          )}

                          {!canPublish && !canClose && (
                            <div className="text-xs text-zinc-500">현재 상태({relatedPost.status})에서는 추가 액션이 없습니다.</div>
                          )}
                        </div>
                      )}

                      {/* create form */}
                      <div className={clsx("mt-4 grid gap-3 md:grid-cols-2", { hidden: relatedPost })}>
                        <div>
                          <label className="text-xs font-medium text-zinc-600">지원 마감(선택)</label>
                          <input
                            type="datetime-local"
                            value={deadline}
                            onChange={(e) => {
                              // ✅ 브라우저 캘린더/시간 선택 UI 사용 (예: 2026-02-01T18:00)
                              setDeadline(e.target.value);
                              if (deadlineErr.length) setCreateErrors((prev) => ({ ...prev, application_deadline: [] }));
                            }}
                            disabled={!!relatedPost}
                            step={60}
                            className={clsx(
                              "mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm",
                              relatedPost && "cursor-not-allowed bg-zinc-50 text-zinc-500",
                              deadlineErr.length && "border-rose-300",
                            )}
                          />
                          {deadlineErr.length ? (
                            <div className="mt-1 text-xs text-rose-600">{deadlineErr[0]}</div>
                          ) : (
                            <p className="mt-1 text-xs text-zinc-500">캘린더에서 날짜를 선택하고 시간을 지정하세요. (예: 2026-02-01T18:00)</p>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-zinc-600">강사 안내(선택)</label>
                          <textarea
                            value={notes}
                            onChange={(e) => {
                              setNotes(e.target.value);
                              if (notesErr.length) setCreateErrors((prev) => ({ ...prev, notes_for_teachers: [] }));
                            }}
                            rows={3}
                            disabled={!!relatedPost}
                            className={clsx(
                              "mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm",
                              relatedPost && "cursor-not-allowed bg-zinc-50 text-zinc-500",
                              notesErr.length && "border-rose-300",
                            )}
                            placeholder="강사에게 전달할 공지/안내사항"
                          />
                          {notesErr.length ? <div className="mt-1 text-xs text-rose-600">{notesErr[0]}</div> : null}
                        </div>
                      </div>

                      <div className={clsx("mt-3 flex items-center gap-2", { hidden: relatedPost })}>
                        <button
                          disabled={creatingPost || !!relatedPost || relatedPostLoading}
                          onClick={async () => {
                            if (!item) return;
                            if (relatedPost) {
                              toast("이미 모집 공고가 존재합니다. 오른쪽 버튼으로 이동하세요.");
                              return;
                            }

                            // ✅ confirm (이제 백엔드가 한 번에 처리)
                            const ok = window.confirm(
                              "모집 공고 초안을 생성할까요?\n\n- 모집 공고 초안이 생성됩니다.\n- 모집 공고 목록 보기 페이지로 이동합니다.",
                            );
                            if (!ok) return;

                            clearErrors();
                            setCreatingPost(true);

                            try {
                              // ✅ 단 1번 요청: 모집 공고 생성 + DispatchRequest.status=CONFIRMED (백엔드 트랜잭션)
                              const res = await coursePostsAPI.create({
                                dispatch_request_id: item.id,
                                application_deadline: deadline ? deadline : null,
                                notes_for_teachers: notes || "",
                              });

                              const newId = res?.data?.id ? Number(res.data.id) : null;
                              const newStatus = res?.data?.status ? String(res.data.status) : "DRAFT";

                              if (newId) {
                                setCreatedPostId(newId);
                                setRelatedPost({ id: newId, status: newStatus });
                              }

                              // ✅ UI 낙관적 업데이트(선택): 모달에 보이는 상태도 즉시 CONFIRMED로 반영
                              setItem((prev) => (prev ? { ...prev, status: "CONFIRMED" } : prev));

                              toast.success("모집 공고 초안이 생성되었습니다. (DRAFT)");
                              onPostCreated?.(newId || undefined);

                              if (newId) gotoPostAndClose(newId);
                            } catch (e: any) {
                              const { fieldErrors, topMessage } = extractFieldErrors(e);
                              setCreateErrors(fieldErrors);
                              setTopError(topMessage || "모집 공고 생성에 실패했습니다.");
                              toast.error(topMessage || "모집 공고 생성에 실패했습니다.");
                            } finally {
                              setCreatingPost(false);
                            }
                          }}
                          className={clsx(
                            "inline-flex items-center rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700",
                            (creatingPost || !!relatedPost || relatedPostLoading) && "cursor-not-allowed opacity-60",
                          )}>
                          {creatingPost
                            ? "생성 중..."
                            : relatedPostLoading
                              ? "확인 중..."
                              : relatedPost
                                ? "모집 공고 존재"
                                : "모집 공고 초안 생성 및 목록 보기 페이지로 이동"}
                        </button>

                        <button
                          onClick={() => {
                            setDeadline("");
                            setNotes("");
                            if (!relatedPost) setCreatedPostId(null);
                            clearErrors();
                          }}
                          className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">
                          입력 초기화
                        </button>
                      </div>

                      <div className="mt-3 text-xs text-zinc-500">
                        * 모집 공고 존재 여부는 서버에서 확인합니다. (CoursePost는 DispatchRequest와 1:1)
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                      모집 공고 생성/관리는 관리자만 가능합니다.
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
