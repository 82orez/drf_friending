"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import DispatchPageShell from "@/components/DispatchPageShell";
import { cultureCentersAPI, dispatchesAPI } from "@/lib/api";
import type { CultureCenterDetail } from "@/types/dispatches";
import { ALL_DAYS, DAY_LABELS, DayKey } from "@/lib/dispatchHelpers";

type FormState = {
  culture_center: string;
  teaching_language: string;
  course_title: string;

  weekdays: DayKey[];

  start_time: string;
  end_time: string;

  start_date: string;
  end_date: string;

  target: string;
  level: string;
  headcount: string;
  is_online: boolean;
  requirements: string;
  notes: string;

  requester_name: string;
  requester_phone: string;
  requester_email: string;
};

const LANGS = [
  { value: "English", label: "English / 영어" },
  { value: "Japanese", label: "Japanese / 일본어" },
  { value: "Chinese", label: "Chinese / 중국어" },
  { value: "Spanish", label: "Spanish / 스페인어" },
];

export default function ManagerNewDispatchRequestPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [centers, setCenters] = useState<CultureCenterDetail[]>([]);
  const [centersLoading, setCentersLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    culture_center: "",
    teaching_language: "English",
    course_title: "",
    weekdays: ["MON"],

    start_time: "10:00",
    end_time: "12:00",

    start_date: "",
    end_date: "",

    target: "",
    level: "",
    headcount: "",
    is_online: false,
    requirements: "",
    notes: "",

    requester_name: "",
    requester_phone: "",
    requester_email: user?.email || "",
  });

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
    if (!loading && user && user.role !== "manager") router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, requester_email: user?.email || prev.requester_email }));
  }, [user?.email]);

  const loadCenters = async () => {
    try {
      setCentersLoading(true);
      const res = await cultureCentersAPI.listMy();
      setCenters(res.data || []);
      if ((res.data || []).length > 0) {
        setForm((prev) => ({ ...prev, culture_center: String(res.data[0].id) }));
      }
    } catch {
      toast.error("지점 목록을 불러오지 못했습니다. (Failed to load centers)");
    } finally {
      setCentersLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "manager") loadCenters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const canSubmit = useMemo(() => {
    return (
      form.culture_center &&
      form.teaching_language &&
      form.course_title.trim().length > 0 &&
      form.weekdays.length > 0 &&
      form.start_time &&
      form.end_time &&
      form.start_date &&
      form.end_date &&
      form.requester_name.trim().length > 0 &&
      form.requester_phone.trim().length > 0 &&
      form.requester_email.trim().length > 0
    );
  }, [form]);

  const toggleDay = (d: DayKey) => {
    setForm((prev) => {
      const has = prev.weekdays.includes(d);
      const next = has ? prev.weekdays.filter((x) => x !== d) : [...prev.weekdays, d];
      return { ...prev, weekdays: next.length ? next : prev.weekdays };
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("필수 항목을 확인해주세요. (Please fill required fields)");
      return;
    }

    try {
      setSaving(true);

      const payload: any = {
        culture_center: Number(form.culture_center),
        teaching_language: form.teaching_language,
        course_title: form.course_title.trim(),
        weekdays: form.weekdays,

        start_time: form.start_time,
        end_time: form.end_time,

        start_date: form.start_date,
        end_date: form.end_date,

        target: form.target.trim(),
        level: form.level.trim(),
        headcount: form.headcount ? Number(form.headcount) : null,
        is_online: form.is_online,
        requirements: form.requirements.trim(),
        notes: form.notes.trim(),

        requester_name: form.requester_name.trim(),
        requester_phone: form.requester_phone.trim(),
        requester_email: form.requester_email.trim(),
      };

      const res = await dispatchesAPI.manager.createRequest(payload);
      toast.success("파견 요청이 생성되었습니다. (Created)");
      router.push(`/manager/dispatches/${res.data.id}`);
    } catch (err: any) {
      toast.error("생성에 실패했습니다. (Failed to create)");
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

  return (
    <DispatchPageShell
      title="New Dispatch Request / 새 파견 요청"
      subtitle="Select your branch and submit a dispatch request."
      backHref="/manager/dispatches"
    >
      <form onSubmit={onSubmit} className="grid gap-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Branch & Class Info / 지점 및 강좌 정보</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Branch / 지점 <span className="text-red-500">*</span>
              </label>
              {centersLoading ? (
                <div className="rounded-xl border bg-gray-50 px-3 py-2 text-sm text-gray-600">Loading centers...</div>
              ) : centers.length === 0 ? (
                <div className="rounded-xl border bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  연결된 지점이 없습니다. Admin에서 CultureCenterMembership를 먼저 등록해주세요.
                </div>
              ) : (
                <select
                  value={form.culture_center}
                  onChange={(e) => setForm((p) => ({ ...p, culture_center: e.target.value }))}
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                >
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.center.name} / {c.branch_name} ({c.region.name})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Teaching language / 언어 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.teaching_language}
                onChange={(e) => setForm((p) => ({ ...p, teaching_language: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
              >
                {LANGS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Course title / 강좌명 <span className="text-red-500">*</span>
              </label>
              <input
                value={form.course_title}
                onChange={(e) => setForm((p) => ({ ...p, course_title: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="e.g. Beginner English Conversation / 초급 영어회화"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Weekdays / 요일 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((d) => {
                  const active = form.weekdays.includes(d);
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
              <p className="mt-2 text-xs text-gray-500">복수 선택 가능 / Multiple selection allowed</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Start time / 시작 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                End time / 종료 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Start date / 시작일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                End date / 종료일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Details / 상세</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Target / 대상</label>
              <input
                value={form.target}
                onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="e.g. Adults / 성인"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Level / 레벨</label>
              <input
                value={form.level}
                onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="e.g. Beginner / 초급"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Headcount / 예상 인원</label>
              <input
                type="number"
                min={0}
                value={form.headcount}
                onChange={(e) => setForm((p) => ({ ...p, headcount: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                id="is_online"
                type="checkbox"
                checked={form.is_online}
                onChange={(e) => setForm((p) => ({ ...p, is_online: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="is_online" className="text-sm text-gray-700">
                Online class / 온라인 수업
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Requirements / 요청 조건</label>
              <textarea
                value={form.requirements}
                onChange={(e) => setForm((p) => ({ ...p, requirements: e.target.value }))}
                className="min-h-[120px] w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="e.g. Native speaker preferred, experience with kids..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes / 비고</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="min-h-[80px] w-full rounded-xl border bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Requester Contact / 신청자 연락처</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name / 이름 <span className="text-red-500">*</span>
              </label>
              <input
                value={form.requester_name}
                onChange={(e) => setForm((p) => ({ ...p, requester_name: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="홍길동 / Gil-dong Hong"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Phone / 연락처 <span className="text-red-500">*</span>
              </label>
              <input
                value={form.requester_phone}
                onChange={(e) => setForm((p) => ({ ...p, requester_phone: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="010-1234-5678"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email / 이메일 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.requester_email}
                onChange={(e) => setForm((p) => ({ ...p, requester_email: e.target.value }))}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="name@example.com"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="text-sm text-gray-500">
            <span className="text-red-500">*</span> 표시된 항목은 필수입니다.
          </div>

          <div className="flex items-center gap-3">
            <Link href="/manager/dispatches" className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit || saving || centers.length === 0}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit request / 요청 제출"}
            </button>
          </div>
        </div>
      </form>
    </DispatchPageShell>
  );
}
