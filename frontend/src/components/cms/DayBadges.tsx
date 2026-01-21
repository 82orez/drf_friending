"use client";

import React from "react";
import clsx from "clsx";

type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

const DAY_LABEL: Record<DayKey, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};

function normalizeDay(v: any): DayKey | null {
  if (!v) return null;
  const up = String(v).trim().toUpperCase();
  if (up in DAY_LABEL) return up as DayKey;
  return null;
}

export default function DayBadges({ days, className }: { days?: any; className?: string }) {
  const list = Array.isArray(days) ? days : [];
  const norm = list.map(normalizeDay).filter(Boolean) as DayKey[];
  if (!norm.length) return <span className="text-sm text-zinc-500">-</span>;

  return (
    <div className={clsx("flex flex-wrap gap-1.5", className)}>
      {norm.map((d, i) => (
        <span key={`${d}-${i}`} className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-sm font-medium text-zinc-800">
          {DAY_LABEL[d]}
        </span>
      ))}
    </div>
  );
}
