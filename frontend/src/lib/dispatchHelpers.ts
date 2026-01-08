export type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export const DAY_LABELS: Record<DayKey, { en: string; ko: string; short: string }> = {
  MON: { en: "Mon", ko: "월", short: "Mon" },
  TUE: { en: "Tue", ko: "화", short: "Tue" },
  WED: { en: "Wed", ko: "수", short: "Wed" },
  THU: { en: "Thu", ko: "목", short: "Thu" },
  FRI: { en: "Fri", ko: "금", short: "Fri" },
  SAT: { en: "Sat", ko: "토", short: "Sat" },
  SUN: { en: "Sun", ko: "일", short: "Sun" },
};

export const ALL_DAYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function formatWeekdays(days: string[] | null | undefined) {
  if (!days || days.length === 0) return "-";
  return days
    .map((d) => {
      const k = d as DayKey;
      return DAY_LABELS[k] ? `${DAY_LABELS[k].en} / ${DAY_LABELS[k].ko}` : d;
    })
    .join(", ");
}

export function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "-";
  if (start && end) return `${start} ~ ${end}`;
  return start || end || "-";
}

export function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "-";
  const s = start?.slice(0, 5) || "-";
  const e = end?.slice(0, 5) || "-";
  return `${s} ~ ${e}`;
}

export function badgeClasses(kind: "gray" | "blue" | "green" | "amber" | "red" | "violet") {
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";
  const map = {
    gray: "bg-gray-50 text-gray-700 ring-gray-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-green-50 text-green-700 ring-green-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  } as const;
  return `${base} ${map[kind]}`;
}

export function statusBadge(status?: string | null) {
  const s = (status || "").toUpperCase();
  if (["REQUESTED"].includes(s)) return { label: "Requested / 요청됨", cls: badgeClasses("gray") };
  if (["REVIEWING"].includes(s)) return { label: "Reviewing / 검토 중", cls: badgeClasses("amber") };
  if (["PUBLISHED"].includes(s)) return { label: "Published / 공고 중", cls: badgeClasses("blue") };
  if (["CLOSED"].includes(s)) return { label: "Closed / 모집 마감", cls: badgeClasses("gray") };
  if (["ASSIGNED"].includes(s)) return { label: "Assigned / 배치 완료", cls: badgeClasses("violet") };
  if (["CONFIRMED"].includes(s)) return { label: "Confirmed / 파견 확정", cls: badgeClasses("green") };
  if (["CANCELED"].includes(s)) return { label: "Canceled / 취소", cls: badgeClasses("red") };
  return { label: status || "-", cls: badgeClasses("gray") };
}
