"use client";

import React from "react";
import ReactCountryFlag from "react-country-flag";
import clsx from "clsx";

type Props = {
  /** ISO 3166-1 alpha-2 (예: "US", "GB", "PH") */
  countryCode?: string | null;
  /** 접근성/툴팁 */
  label?: string;
  /** px */
  size?: number;
  className?: string;
};

export default function Flag({ countryCode, label, size = 16, className }: Props) {
  // OTHER 같은 경우(국가코드 없음) -> 중립 아이콘(이모지 없이)
  if (!countryCode) {
    return (
      <span
        aria-hidden="true"
        title={label}
        className={clsx(
          "inline-flex items-center justify-center rounded-sm border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-600",
          className,
        )}
        style={{ width: size, height: size, lineHeight: 1 }}>
        ?
      </span>
    );
  }

  return (
    <span aria-hidden="true" title={label} className={clsx("inline-flex leading-none", className)}>
      <ReactCountryFlag
        countryCode={countryCode.toUpperCase()}
        svg
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(2, Math.floor(size / 8)),
        }}
        aria-label={label}
      />
    </span>
  );
}
