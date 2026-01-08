"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import DispatchPageShell from "@/components/DispatchPageShell";
import { dispatchesAPI } from "@/lib/api";
import type { DispatchRequest } from "@/types/dispatches";
import { ALL_DAYS, DAY_LABELS, DayKey, formatDateRange, formatTimeRange, formatWeekdays, statusBadge } from "@/lib/dispatchHelpers";

export default function ManagerDispatchRequestDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const id = Number(params.id);

  const [item, setItem] = useState<DispatchRequest | null>(null);
  const [fetching, setFetching] = useState(true);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // editable form
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
    if (!loading && user && user.role !== "manager") router.push("/");
  }, [user, loading, router]);

  const load = async () => {
    try {
      setFetching(true);
      const res = await dispatchesAPI.manager.getRequest(id);
      setItem(res.data);
      setForm({
        course_title: res.data.course_title || "",
        teaching_language: res.data.teaching_language || "English",
        weekdays: (res.data.weekdays || []) as DayKey[],
        start_time: (res.data.start_time || "").slice(0, 5),
        end_time: (res.data.end_time || "").slice(0, 5),
        start_date: res.data.start_date || "",
        end_date: res.data.end_date || "",
        target: res.data.target || "",
        level: res.data.level || "",
        headcount: res.data.headcount ?? "",
        is_online: !!res.data.is_online,
        requirements: res.data.requirements || "",
        notes: res.data.notes || "",
        requester_name: res.data.requester_name || "",
        requester_phone: res.data.requester_phone || "",
        requester_email: res.data.requester_email || "",
      });
    } catch {
      toast.error("상세 정보를 불러오지 못했습니다. (Failed to load)");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (user?.role === "manager" && Number.isFinite(id)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, id]);

  const canEdit = useMemo(() => {
    const s = (item?.status || "").toUpperCase();
    return ["REQUESTED", "REVIEWING"].includes(s);
  }, [item?.status]);

  const toggleDay = (d: DayKey) => {
    setForm((prev: any) => {
      const arr: DayKey[] = prev.weekdays || [];
      const has = arr.includes(d);
      const next = has ? arr.filter((x) => x !== d) : [...arr, d];
      return { ...prev, weekdays: next.length ? next : arr };
    });
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;

    try {
      setSaving(true);
      const payload: any = {
        course_title: String(form.course_title || "").trim(),
        teaching_language: String(form.teaching_language || "English"),
        weekdays: form.weekdays || [],
        start_time: form.start_time,
        end_time: form.end_time,
        start_date: form.start_date,
        end_date: form.end_date,
        target: String(form.target || "").trim(),
        level: String(form.level || "").trim(),
        headcount: form.headcount === "" ? null : Number(form.headcount),
        is_online: !!form.is_online,
        requirements: String(form.requirements || "").trim(),
        notes: String(form.notes || "").trim(),
        requester_name: String(form.requester_name || "").trim(),
        requester_phone: String(form.requester_phone || "").trim(),
        requester_email: String(form.requester_email || "").trim(),
      };

      const res = await dispatchesAPI.manager.updateRequest(id, payload);
      setItem(res.data);
      setEditing(false);
      toast.success("저장되었습니다. (Saved)");
    } catch {
      toast.error("저장에 실패했습니다. (Failed to save)");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const b = statusBadge(item?.status);
  const cc = item?.culture_center_detail;

  return (
    <DispatchPageShell title="Request Detail / 요청 상세" backHref="/manager/dispatches">
      {fetching || !item ? (
        <div className="rounded-2xl border bg-white p-6">Loading...</div>
      ) : (
        <div className="grid gap-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={b.cls}>{b.label}</span>
                  <span className="text-sm text-gray-600">{item.teaching_language}</span>
                </div>
                <h2 className="mt-2 text-xl font-semibold text-gray-900">{item.course_title}</h2>

                <div className="mt-3 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
                  <div>
                    <span className="text-gray-500">Branch:</span>{" "}
                    <b>{cc ? `${cc.center_name} / ${cc.branch_name}` : item.culture_center}</b>
                  </div>
                  <div>
                    <span className="text-gray-500">Region:</span> {cc?.region_name || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Schedule:</span> {formatWeekdays(item.weekdays)}
                  </div>
                  <div>
                    <span className="text-gray-500">Time:</span> {formatTimeRange(item.start_time, item.end_time)}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-500">Period:</span> {formatDateRange(item.start_date, item.end_date)}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="text-sm text-gray-600">
                  Applicants: <b className="text-gray-900">{item.applications_count ?? 0}</b>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={load}
                    className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                    disabled={fetching}
                  >
                    Refresh
                  </button>

                  {canEdit ? (
                    <button
                      onClick={() => setEditing((v) => !v)}
                      className="rounded-xl bg-black px-3 py-2 text-sm font-medium text-white shadow-sm"
                    >
                      {editing ? "Cancel edit" : "Edit"}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">공고 이후에는 수정이 제한됩니다.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Request Fields / 요청 정보</h3>

            {!editing ? (
              <div className="mt-4 grid gap-3 text-sm text-gray-800 sm:grid-cols-2">
                <div>
                  <span className="text-gray-500">Target:</span> {item.target || "-"}
                </div>
                <div>
                  <span className="text-gray-500">Level:</span> {item.level || "-"}
                </div>
                <div>
                  <span className="text-gray-500">Headcount:</span> {item.headcount ?? "-"}
                </div>
                <div>
                  <span className="text-gray-500">Online:</span> {item.is_online ? "Yes" : "No"}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500">Requirements:</span>
                  <div className="mt-1 whitespace-pre-wrap rounded-xl border bg-gray-50 px-3 py-2">
                    {item.requirements || "-"}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500">Notes:</span>
                  <div className="mt-1 whitespace-pre-wrap rounded-xl border bg-gray-50 px-3 py-2">{item.notes || "-"}</div>
                </div>
              </div>
            ) : (
              <form onSubmit={onSave} className="mt-4 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Course title / 강좌명</label>
                    <input
                      value={form.course_title}
                      onChange={(e) => setForm((p: any) => ({ ...p, course_title: e.target.value }))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Teaching language</label>
                    <select
                      value={form.teaching_language}
                      onChange={(e) => setForm((p: any) => ({ ...p, teaching_language: e.target.value }))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    >
                      <option value="English">English / 영어</option>
                      <option value="Japanese">Japanese / 일본어</option>
                      <option value="Chinese">Chinese / 중국어</option>
                      <option value="Spanish">Spanish / 스페인어</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">Weekdays</label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_DAYS.map((d) => {
                        const active = (form.weekdays || []).includes(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleDay(d)}
                            className={[
                              "rounded-full border px-3 py-1.5 text-sm",
                              active ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                            ].join(" ")}
                          >
                            {DAY_LABELS[d].en} / {DAY_LABELS[d].ko}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Start time</label>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm((p: any) => ({ ...p, start_time: e.target.value }))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">End time</label>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm((p: any) => ({ ...p, end_time: e.target.value }))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Start date</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm((p: any) => ({ ...p, start_date: e.target.value }))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">End date</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm((p: any) => ({ ...p, end_date: e.target.value }))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Target</label>
                    <input
                      value={form.target}
                      onChange={(e) => setForm((p: any) => ({ ...p, target: e.target.value }))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Level</label>
                    <input
                      value={form.level}
                      onChange={(e) => setForm((p: any) => ({ ...p, level: e.target.value }))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Headcount</label>
                    <input
                      type="number"
                      min={0}
                      value={form.headcount}
                      onChange={(e) => setForm((p: any) => ({ ...p, headcount: e.target.value }))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="is_online"
                      type="checkbox"
                      checked={!!form.is_online}
                      onChange={(e) => setForm((p: any) => ({ ...p, is_online: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="is_online" className="text-sm text-gray-700">
                      Online class / 온라인 수업
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Requirements</label>
                    <textarea
                      value={form.requirements}
                      onChange={(e) => setForm((p: any) => ({ ...p, requirements: e.target.value }))}
                      className="min-h-[110px] w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((p: any) => ({ ...p, notes: e.target.value }))}
                      className="min-h-[80px] w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">Requester Contact</h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                      <input
                        value={form.requester_name}
                        onChange={(e) => setForm((p: any) => ({ ...p, requester_name: e.target.value }))}
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        value={form.requester_phone}
                        onChange={(e) => setForm((p: any) => ({ ...p, requester_phone: e.target.value }))}
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        value={form.requester_email}
                        onChange={(e) => setForm((p: any) => ({ ...p, requester_email: e.target.value }))}
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save changes / 저장"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Next Steps / 다음 단계</h3>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
              <li>관리자가 요청을 확인하면 공고(Published)로 전환됩니다.</li>
              <li>공고가 된 이후에는 강사들이 지원할 수 있습니다.</li>
              <li>지원자가 생기면 “Applicants” 숫자가 증가합니다.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end">
            <Link href="/manager/dispatches" className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50">
              Back to list
            </Link>
          </div>
        </div>
      )}
    </DispatchPageShell>
  );
}
