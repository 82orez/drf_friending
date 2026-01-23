"use client";

import React from "react";
import clsx from "clsx";

export default function StatusPill({ value, className }: { value?: string | null; className?: string }) {
  const v = (value || "").toUpperCase();

  const base = "inline-flex items-center rounded-xl px-2 py-2 text-xs font-semibold ring-1 ring-inset";

  const color =
    v === "PUBLISHED" || v === "CONFIRMED" || v === "ONGOING"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : v === "DRAFT" || v === "REVIEWING" || v === "IN_REVIEW"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : v === "CLOSED" || v === "ENDED"
          ? "bg-zinc-100 text-zinc-700 ring-zinc-200"
          : v === "CANCELLED" || v === "REJECTED" || v === "WITHDRAWN"
            ? "bg-rose-50 text-rose-700 ring-rose-200"
            : v === "SELECTED" || v === "SHORTLISTED" || v === "NEW"
              ? "bg-indigo-100 text-indigo-700 ring-indigo-200"
              : "bg-zinc-100 text-zinc-700 ring-zinc-200";

  const label = v === "IN_REVIEW" ? "게시 대기 중" : v === "DRAFT" ? "게시 대기 중" : v === "NEW" ? "신규 접수" : value || "-";

  return <span className={clsx(base, color, className)}>{label}</span>;
}
