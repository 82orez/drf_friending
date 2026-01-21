"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import api from "@/lib/api";
import { dispatchRequestsAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

import PageShell from "@/components/cms/PageShell";
import StatusPill from "@/components/cms/StatusPill";
import DayBadges from "@/components/cms/DayBadges";
import DispatchRequestModal, { type CultureCenterBranch } from "@/components/dispatch/DispatchRequestModal";

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

  culture_center: CultureCenterBranch;

  created_at: string;
};

function fmtTimeRange(s?: string | null, e?: string | null) {
  if (!s && !e) return "-";
  if (s && e) return `${s} ~ ${e}`;
  return s || e || "-";
}

export default function DispatchRequestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<DispatchRequest[]>([]);
  const [fetching, setFetching] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);

  const [branches, setBranches] = useState<CultureCenterBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  const fetchBranches = async () => {
    try {
      setBranchesLoading(true);
      setBranchesError(null);
      const res = await api.get("/culture-centers/branches/");
      setBranches(res.data || []);
    } catch (e: any) {
      setBranchesError("지점 목록을 불러오지 못했습니다.");
    } finally {
      setBranchesLoading(false);
    }
  };

  const fetchList = async () => {
    try {
      setFetching(true);
      const res = isAdmin ? await dispatchRequestsAPI.adminList() : await dispatchRequestsAPI.myList();
      setItems(res.data || []);
    } catch (e: any) {
      toast.error("파견요청 목록을 불러오지 못했습니다.");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchBranches();
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const subtitle = useMemo(() => {
    return isAdmin ? "전체 파견요청을 확인합니다." : "내가 생성한 파견요청 목록입니다.";
  }, [isAdmin]);

  return (
    <>
      <PageShell
        title="파견요청"
        subtitle={subtitle}
        backHref="/admin"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50">
            + 파견요청 생성
          </button>
        }>
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4">
            <div className="text-sm font-semibold text-zinc-900">목록</div>
            <div className="text-sm text-zinc-600">{fetching ? "불러오는 중..." : `${items.length}건`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">센터/지점</th>
                  <th className="px-4 py-3">언어</th>
                  <th className="px-4 py-3">형태</th>
                  <th className="px-4 py-3">강좌명</th>
                  <th className="px-4 py-3">요일</th>
                  <th className="px-4 py-3">시간</th>
                  <th className="px-4 py-3">시작일</th>
                  <th className="px-4 py-3">종료일</th>
                  <th className="px-4 py-3">횟수</th>
                </tr>
              </thead>
              <tbody className="text-sm text-zinc-900">
                {!fetching && !items.length ? (
                  <tr>
                    <td className="px-4 py-6 text-zinc-600" colSpan={9}>
                      아직 파견요청이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3"># {it.id}</td>
                      <td className="px-4 py-3">
                        <StatusPill value={it.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold">
                          {it.culture_center?.center_name} / {it.culture_center?.branch_name}
                        </div>
                        <div className="text-xs text-zinc-600">{it.culture_center?.region_name}</div>
                      </td>
                      <td className="px-4 py-3">{it.teaching_language}</td>
                      <td className="px-4 py-3">{it.instructor_type}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/dispatch-requests/${it.id}`} className="font-semibold text-zinc-900 hover:underline">
                          {it.course_title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <DayBadges days={it.class_days} />
                      </td>
                      <td className="px-4 py-3">{fmtTimeRange(it.start_time, it.end_time)}</td>
                      <td className="px-4 py-3">{it.start_date || "-"}</td>
                      <td className="px-4 py-3">{it.end_date || "-"}</td>
                      <td className="px-4 py-3">{it.lecture_count ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageShell>

      <DispatchRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        branches={branches}
        branchesLoading={branchesLoading}
        branchesError={branchesError}
        defaultApplicantEmail={user?.email || ""}
        onSubmitSuccess={(msg) => {
          toast.success(msg || "파견요청이 생성되었습니다.");
          setModalOpen(false);
          fetchList();
        }}
        onSubmitError={(msg) => toast.error(msg || "파견요청 생성에 실패했습니다.")}
      />
    </>
  );
}
