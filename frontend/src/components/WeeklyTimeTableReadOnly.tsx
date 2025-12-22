"use client";

import React, { useMemo, useState } from "react";
import clsx from "clsx";
import type { AvailableTimeSlots } from "@/components/WeeklyTimeTablePicker";
import { ChevronDown } from "lucide-react";

type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

const DAYS: Array<{ key: DayKey; label: string; short: string }> = [
  { key: "MON", label: "Mon / 월", short: "Mon" },
  { key: "TUE", label: "Tue / 화", short: "Tue" },
  { key: "WED", label: "Wed / 수", short: "Wed" },
  { key: "THU", label: "Thu / 목", short: "Thu" },
  { key: "FRI", label: "Fri / 금", short: "Fri" },
  { key: "SAT", label: "Sat / 토", short: "Sat" },
  { key: "SUN", label: "Sun / 일", short: "Sun" },
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

function safeParseJSON(input: unknown): unknown {
  if (typeof input !== "string") return input;
  const s = input.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function normalizeAvailableTimeSlots(input: unknown): AvailableTimeSlots | null {
  if (input == null) return null;

  const parsed = safeParseJSON(input);
  if (!parsed || typeof parsed !== "object") return null;

  const v = parsed as any;

  const daysRaw = v.days && typeof v.days === "object" ? v.days : null;
  const nextDays: Record<DayKey, number[]> = buildEmptyDays();

  if (daysRaw) {
    for (const d of DAYS) {
      const arr = daysRaw[d.key];
      if (Array.isArray(arr)) {
        nextDays[d.key] = arr
          .map((x: any) => Number(x))
          .filter((n: number) => Number.isFinite(n))
          .sort((a: number, b: number) => a - b);
      }
    }
  }

  const startHour = Number.isFinite(Number(v.startHour)) ? Number(v.startHour) : 6;
  const endHour = Number.isFinite(Number(v.endHour)) ? Number(v.endHour) : 24;

  // stepMinutes는 30으로 고정(호환/방어)
  return {
    ...defaultPayload(),
    startHour,
    endHour,
    stepMinutes: 30,
    days: nextDays,
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

function summarizeCompact(p: AvailableTimeSlots | null) {
  if (!p) return "-";
  const parts: string[] = [];
  for (const d of DAYS) {
    const slots = p.days?.[d.key] ?? [];
    if (!slots.length) continue;
    const ranges = toRanges(slots, p.stepMinutes);
    parts.push(`${d.short} ${ranges.join(", ")}`);
  }
  return parts.length ? parts.join(" · ") : "Not selected / 선택 안 함";
}

function isSelected(payload: AvailableTimeSlots, day: DayKey, slotIndex: number) {
  return (payload.days?.[day] ?? []).includes(slotIndex);
}

function buildSlots(p: AvailableTimeSlots) {
  const list: number[] = [];
  const startMin = p.startHour * 60;
  const endMin = p.endHour * 60;
  for (let m = startMin; m < endMin; m += p.stepMinutes) list.push(m / p.stepMinutes);
  return list;
}

function labelForRow(slotIndex: number, stepMinutes: number) {
  const min = toMinutes(slotIndex, stepMinutes);
  // 시간 단위 라벨만 보여주기(가독성 ↑)
  if (min % 60 !== 0) return "";
  return minutesToLabel(min);
}

/**
 * ✅ 카드/리스트용: 한 줄 요약(길면 자연스럽게 줄바꿈/클램프 가능)
 */
export function WeeklyTimeTableSummary({ value, className }: { value: unknown; className?: string }) {
  const normalized = useMemo(() => normalizeAvailableTimeSlots(value), [value]);
  const text = useMemo(() => summarizeCompact(normalized), [normalized]);

  return (
    <span
      className={clsx(
        "inline-block max-w-[260px] text-right text-sm font-medium text-gray-900",
        "line-clamp-2",
        !normalized || text.startsWith("Not selected") ? "text-gray-500" : "",
        className,
      )}
      title={typeof text === "string" ? text : undefined}>
      {text}
    </span>
  );
}

/**
 * ✅ 상세 모달용: 요약 리스트 + 미니 그리드(읽기 전용)
 */
export default function WeeklyTimeTableReadOnly({
  value,
  className,
  showMiniGrid = true,
}: {
  value: unknown;
  className?: string;
  showMiniGrid?: boolean;
}) {
  const normalized = useMemo(() => normalizeAvailableTimeSlots(value), [value]);

  // ✅ 토글 상태 (기본: 접힘)
  const [isOpen, setIsOpen] = useState(false);

  // ✅ 요일 칸 폭 줄이기
  const TIME_COL_PX = 90;
  const DAY_COL_PX = 96;
  const GRID_TEMPLATE = `${TIME_COL_PX}px repeat(${DAYS.length}, ${DAY_COL_PX}px)`;

  const dayItems = useMemo(() => {
    const p = normalized;
    if (!p) return [];
    return DAYS.map((d) => {
      const slots = p.days?.[d.key] ?? [];
      const ranges = slots.length ? toRanges(slots, p.stepMinutes) : [];
      return { ...d, ranges };
    });
  }, [normalized]);

  const hasAny = useMemo(() => {
    if (!normalized) return false;
    return DAYS.some((d) => (normalized.days?.[d.key] ?? []).length > 0);
  }, [normalized]);

  const slots = useMemo(() => (normalized ? buildSlots(normalized) : []), [normalized]);

  if (!normalized) {
    return <div className={clsx("text-sm text-gray-500", className)}>-</div>;
  }

  return (
    <div className={clsx("space-y-4", className)}>
      {/* Top summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-gray-900">요일별 강의 가능 시간대</div>
          <div className="text-xs text-gray-500">
            {normalized.tz} · {normalized.stepMinutes}m
          </div>
        </div>

        {!hasAny ? (
          <div className="mt-2 text-sm text-gray-500">Not selected / 선택 안 함</div>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {dayItems.map((d) => (
              <div key={d.key} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
                <div className="text-xs font-semibold text-gray-700">{d.label}</div>
                <div className="text-right text-xs font-medium text-gray-900">
                  {d.ranges.length ? d.ranges.join(", ") : <span className="text-gray-400">-</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ✅ 토글 버튼 (오른쪽 Chevron) */}
        {showMiniGrid && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setIsOpen((v) => !v)}
              aria-expanded={isOpen}
              className={clsx(
                "w-full rounded-xl border border-gray-200 bg-white px-3 py-2",
                "text-sm font-semibold text-gray-900",
                "hover:bg-gray-50 active:bg-gray-100",
                "transition",
                "flex items-center justify-between gap-3",
              )}>
              <span>{isOpen ? "주간 타임 테이블 닫기" : "주간 타임 테이블 상세 보기"}</span>

              <ChevronDown className={clsx("h-4 w-4 text-gray-500 transition-transform duration-200", isOpen ? "rotate-180" : "rotate-0")} />
            </button>
          </div>
        )}

        {/* Mini grid (read-only heatmap) - ✅ 토글로 펼침/접힘 */}
        {showMiniGrid && (
          <div
            className={clsx(
              "mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white",
              "transition-[max-height,opacity] duration-300 ease-out",
              isOpen ? "max-h-[1600px] opacity-100" : "max-h-0 opacity-0",
            )}>
            {/* 내용은 접힌 상태에서도 DOM에 남아있지만, max-height로 숨김 */}
            <div className="overflow-x-hidden">
              {/* ✅ min-w 제거: 화면 폭에 맞춰 자연스럽게 맞춤 */}
              <div>
                {/* Header */}
                <div className="sticky top-0 z-10 grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                  <div className="border-b border-gray-200 bg-gray-50 px-2 py-2 text-[11px] font-semibold text-gray-600">Time</div>

                  {DAYS.map((d) => (
                    <div
                      key={d.key}
                      className="border-b border-gray-200 bg-gray-50 px-1 py-2 text-center text-[11px] font-semibold text-gray-600"
                      title={d.label}>
                      {/* ✅ 짧은 라벨로 폭 절약 */}
                      {d.short}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {slots.map((slotIndex) => {
                  const rowLabel = labelForRow(slotIndex, normalized.stepMinutes);
                  return (
                    <div key={slotIndex} className="grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                      <div className="border-b border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-500">{rowLabel}</div>

                      {DAYS.map((d) => {
                        const on = isSelected(normalized, d.key, slotIndex);
                        return (
                          <div
                            key={`${d.key}-${slotIndex}`}
                            className={clsx("border-b border-gray-200 px-1 py-1.5", on ? "bg-gray-900/10" : "bg-white")}
                            title={rowLabel ? `${d.label} ${rowLabel}` : d.label}>
                            <div className={clsx("h-3 w-full rounded-md border", on ? "border-gray-900 bg-gray-900/20" : "border-gray-200")} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">Availability / 강의 가능 시간대</div>
          </div>
        )}
      </div>
    </div>
  );
}
