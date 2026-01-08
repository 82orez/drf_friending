"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import DispatchPageShell from "@/components/DispatchPageShell";
import { dispatchesAPI } from "@/lib/api";
import type { DispatchRequest } from "@/types/dispatches";
import { formatDateRange, formatTimeRange, formatWeekdays, statusBadge } from "@/lib/dispatchHelpers";

export default function ManagerDispatchRequestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<DispatchRequest[]>([]);
  const [fetching, setFetching] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
    if (!loading && user && user.role !== "manager") router.push("/");
  }, [user, loading, router]);

  const load = async () => {
    try {
      setFetching(true);
      const res = await dispatchesAPI.manager.listRequests();
      setItems(res.data || []);
    } catch (e: any) {
      toast.error("요청 목록을 불러오지 못했습니다. (Failed to load)");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (user?.role === "manager") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return items;
    return items.filter((x) => (x.status || "").toUpperCase() === statusFilter);
  }, [items, statusFilter]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <DispatchPageShell
      title="Dispatch Requests / 강사 파견 요청"
      subtitle="Create and track your dispatch requests for your culture center branches."
      right={
        <Link
          href="/manager/dispatches/new"
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-gray-200"
        >
          + New request
        </Link>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          총 <b>{filtered.length}</b>건 (Total: {filtered.length})
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            <option value="REQUESTED">Requested</option>
            <option value="REVIEWING">Reviewing</option>
            <option value="PUBLISHED">Published</option>
            <option value="CLOSED">Closed</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELED">Canceled</option>
          </select>

          <button
            onClick={load}
            className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            disabled={fetching}
          >
            Refresh
          </button>
        </div>
      </div>

      {fetching ? (
        <div className="rounded-2xl border bg-white p-6 text-gray-700">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          <p className="text-gray-700">아직 파견 요청이 없습니다. (No requests yet)</p>
          <p className="mt-2 text-sm text-gray-500">오른쪽 위의 “New request” 버튼으로 생성할 수 있어요.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((it) => {
            const b = statusBadge(it.status);
            const cc = it.culture_center_detail;
            return (
              <Link
                key={it.id}
                href={`/manager/dispatches/${it.id}`}
                className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={b.cls}>{b.label}</span>
                      <span className="text-sm text-gray-600">{it.teaching_language}</span>
                    </div>
                    <h3 className="mt-2 truncate text-lg font-semibold text-gray-900">{it.course_title}</h3>

                    <div className="mt-2 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
                      <div>
                        <span className="text-gray-500">Branch:</span>{" "}
                        <b>{cc ? `${cc.center_name} / ${cc.branch_name}` : it.culture_center}</b>
                      </div>
                      <div>
                        <span className="text-gray-500">Region:</span> {cc?.region_name || "-"}
                      </div>
                      <div>
                        <span className="text-gray-500">Schedule:</span> {formatWeekdays(it.weekdays)}
                      </div>
                      <div>
                        <span className="text-gray-500">Time:</span> {formatTimeRange(it.start_time, it.end_time)}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-gray-500">Period:</span> {formatDateRange(it.start_date, it.end_date)}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 text-sm text-gray-600">
                    <div>
                      Applicants: <b className="text-gray-900">{it.applications_count ?? 0}</b>
                    </div>
                    <div className="text-xs text-gray-500">ID: {it.id}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </DispatchPageShell>
  );
}
