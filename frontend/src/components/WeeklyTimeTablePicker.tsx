"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export type AvailableTimeSlots = {
  tz: "Asia/Seoul";
  stepMinutes: 30; // ✅ 30분 단위
  startHour: number; // inclusive
  endHour: number; // exclusive
  /**
   * slotIndex = (minutesFromMidnight / stepMinutes)
   * 예: 09:00 => 18 (9*2), 09:30 => 19
   */
  days: Record<DayKey, number[]>;
};

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "MON", label: "Mon / 월" },
  { key: "TUE", label: "Tue / 화" },
  { key: "WED", label: "Wed / 수" },
  { key: "THU", label: "Thu / 목" },
  { key: "FRI", label: "Fri / 금" },
  { key: "SAT", label: "Sat / 토" },
  { key: "SUN", label: "Sun / 일" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

function buildEmptyDays(): Record<DayKey, number[]> {
  return { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
}

function defaultPayload(): AvailableTimeSlots {
  return {
    tz: "Asia/Seoul",
    stepMinutes: 30,
    startHour: 6,
    endHour: 24,
    days: buildEmptyDays(),
  };
}

function normalizePayload(v?: AvailableTimeSlots | null): AvailableTimeSlots {
  if (!v) return defaultPayload();

  // 방어적으로 stepMinutes 강제(필요 시 마이그레이션/호환)
  return {
    tz: "Asia/Seoul",
    stepMinutes: 30,
    startHour: typeof v.startHour === "number" ? v.startHour : 6,
    endHour: typeof v.endHour === "number" ? v.endHour : 24,
    days: v.days ?? buildEmptyDays(),
  };
}

function toMinutes(slotIndex: number, stepMinutes: number) {
  return slotIndex * stepMinutes;
}

function minutesToLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function toRanges(slotIndices: number[], stepMinutes: number) {
  // slotIndices: [18,19,20,28,29] -> [09:00-10:30], [14:00-15:00] (step=30)
  const sorted = Array.from(new Set(slotIndices)).sort((a, b) => a - b);
  const ranges: Array<{ startSlot: number; endSlotExclusive: number }> = [];
  let i = 0;

  while (i < sorted.length) {
    const start = sorted[i];
    let end = start + 1;
    i++;
    while (i < sorted.length && sorted[i] === end) {
      end++;
      i++;
    }
    ranges.push({ startSlot: start, endSlotExclusive: end });
  }

  return ranges.map((r) => {
    const startMin = toMinutes(r.startSlot, stepMinutes);
    const endMin = toMinutes(r.endSlotExclusive, stepMinutes);
    return `${minutesToLabel(startMin)}-${minutesToLabel(endMin)}`;
  });
}

function summarize(v: AvailableTimeSlots | null | undefined) {
  const p = normalizePayload(v);
  const parts: string[] = [];

  for (const d of DAYS) {
    const slots = p.days?.[d.key] ?? [];
    if (!slots.length) continue;
    const ranges = toRanges(slots, p.stepMinutes);
    parts.push(`${d.label}: ${ranges.join(", ")}`);
  }

  return parts.length ? parts.join(" · ") : "Not selected / 선택 안 함";
}

function isSelected(payload: AvailableTimeSlots, day: DayKey, slotIndex: number) {
  return (payload.days?.[day] ?? []).includes(slotIndex);
}

function setSlot(payload: AvailableTimeSlots, day: DayKey, slotIndex: number, on: boolean) {
  const prev = new Set(payload.days?.[day] ?? []);
  if (on) prev.add(slotIndex);
  else prev.delete(slotIndex);
  return { ...payload, days: { ...payload.days, [day]: Array.from(prev).sort((a, b) => a - b) } };
}

function clearAll(payload: AvailableTimeSlots) {
  return { ...payload, days: buildEmptyDays() };
}

function applyPreset(payload: AvailableTimeSlots, targetDays: DayKey[], fromHour: number, toHour: number) {
  const step = payload.stepMinutes; // 30
  const fromSlot = (fromHour * 60) / step;
  const toSlot = (toHour * 60) / step;

  const next = { ...payload, days: { ...payload.days } };
  for (const day of targetDays) {
    const set = new Set(next.days[day] ?? []);
    for (let s = fromSlot; s < toSlot; s++) set.add(s);
    next.days[day] = Array.from(set).sort((a, b) => a - b);
  }
  return next;
}

export default function WeeklyTimeTablePicker({
  value,
  onChange,
  disabled,
  errorText,
}: {
  value: AvailableTimeSlots | null;
  onChange: (next: AvailableTimeSlots | null) => void;
  disabled?: boolean;
  errorText?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AvailableTimeSlots>(() => normalizePayload(value));

  // ✅ 포인터(마우스/터치) 드래그 페인팅 상태
  const paintingRef = useRef(false);
  const paintModeRef = useRef<"on" | "off">("on");
  const lastKeyRef = useRef<string>("");

  const slots = useMemo(() => {
    const p = normalizePayload(draft);
    const startMin = p.startHour * 60;
    const endMin = p.endHour * 60;
    const list: number[] = [];
    for (let m = startMin; m < endMin; m += p.stepMinutes) {
      list.push(m / p.stepMinutes); // slotIndex
    }
    return list;
  }, [draft]);

  const leftLabels = useMemo(() => {
    const p = normalizePayload(draft);
    return slots.map((slotIndex) => {
      const min = toMinutes(slotIndex, p.stepMinutes);
      return minutesToLabel(min);
    });
  }, [draft, slots]);

  useEffect(() => {
    setDraft(normalizePayload(value));
  }, [value]);

  const summaryText = useMemo(() => summarize(value), [value]);

  const openModal = () => {
    if (disabled) return;
    setDraft(normalizePayload(value));
    setOpen(true);
  };

  const closeModal = () => {
    paintingRef.current = false;
    lastKeyRef.current = "";
    setOpen(false);
  };

  const startPaint = (day: DayKey, slotIndex: number) => {
    const currently = isSelected(draft, day, slotIndex);
    paintModeRef.current = currently ? "off" : "on";
    paintingRef.current = true;

    setDraft((prev) => setSlot(prev, day, slotIndex, paintModeRef.current === "on"));
    lastKeyRef.current = `${day}-${slotIndex}`;
  };

  const continuePaint = (day: DayKey, slotIndex: number) => {
    if (!paintingRef.current) return;
    const k = `${day}-${slotIndex}`;
    if (k === lastKeyRef.current) return; // 같은 셀 중복 방지
    lastKeyRef.current = k;

    setDraft((prev) => setSlot(prev, day, slotIndex, paintModeRef.current === "on"));
  };

  useEffect(() => {
    const stop = () => {
      paintingRef.current = false;
      lastKeyRef.current = "";
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const selectedPreview = useMemo(() => summarize(draft), [draft]);

  return (
    <div>
      {/* 입력창처럼 보이는 버튼 */}
      <button
        type="button"
        onClick={openModal}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-900 ring-slate-900/5 outline-none focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100">
        <div className="flex items-center justify-between gap-3">
          <span className={summaryText.startsWith("Not selected") ? "text-slate-400" : ""}>{summaryText}</span>
          <span className="shrink-0 text-slate-400">Click to select</span>
        </div>
      </button>

      {errorText ? <p className="mt-1 text-xs text-red-500">{errorText}</p> : null}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="absolute top-1/2 left-1/2 w-[min(1040px,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Available Time Slots / 근무 가능 시간대</h3>
                <p className="mt-1 text-xs text-slate-500">Drag to paint (mouse/touch). / 드래그로 선택하세요 (모바일 터치 지원)</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>

            {/* Presets */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDraft((prev) => applyPreset(prev, ["MON", "TUE", "WED", "THU", "FRI"], 18, 22))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50">
                Weekdays 18-22 / 평일 저녁
              </button>
              <button
                type="button"
                onClick={() => setDraft((prev) => applyPreset(prev, ["SAT", "SUN"], 10, 18))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50">
                Weekends 10-18 / 주말
              </button>
              <button
                type="button"
                onClick={() => setDraft((prev) => applyPreset(prev, ["MON", "TUE", "WED", "THU", "FRI"], 9, 12))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50">
                Weekdays 9-12 / 평일 오전
              </button>
              <button
                type="button"
                onClick={() => setDraft((prev) => clearAll(prev))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50">
                Clear / 초기화
              </button>
            </div>

            <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
              <div className="min-w-[920px] touch-none">
                {/* Header */}
                <div className="grid" style={{ gridTemplateColumns: `110px repeat(${DAYS.length}, 1fr)` }}>
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Time</div>
                  {DAYS.map((d) => (
                    <div key={d.key} className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                      {d.label}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {slots.map((slotIndex, rowIdx) => {
                  const time = leftLabels[rowIdx];
                  return (
                    <div key={slotIndex} className="grid" style={{ gridTemplateColumns: `110px repeat(${DAYS.length}, 1fr)` }}>
                      <div className="border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">{time}</div>

                      {DAYS.map((d) => {
                        const on = isSelected(draft, d.key, slotIndex);
                        return (
                          <div
                            key={`${d.key}-${slotIndex}`}
                            className={[
                              "border-b border-slate-200 px-2 py-2",
                              "select-none",
                              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                              on ? "bg-slate-900/10" : "bg-white hover:bg-slate-50",
                            ].join(" ")}
                            onPointerDown={(e) => {
                              if (disabled) return;
                              e.preventDefault();
                              startPaint(d.key, slotIndex);
                            }}
                            onPointerEnter={() => {
                              if (disabled) return;
                              continuePaint(d.key, slotIndex);
                            }}
                            title={`${d.label} ${time}`}>
                            <div
                              className={["h-5 w-full rounded-md border", on ? "border-slate-900 bg-slate-900/20" : "border-slate-200"].join(" ")}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-600">
                Selected: <span className="font-medium text-slate-900">{selectedPreview}</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange(draft);
                    closeModal();
                  }}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  Save / 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
