"use client";

import React from "react";
import clsx from "clsx";
import Link from "next/link";

export default function PageShell({
  title,
  subtitle,
  backHref,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {backHref && (
              <Link href={backHref} className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-900">
                ← Back
              </Link>
            )}
            <h1 className={clsx("mt-2 text-2xl font-bold tracking-tight text-zinc-900", !backHref && "mt-0")}>{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {children}
      </div>
    </div>
  );
}
