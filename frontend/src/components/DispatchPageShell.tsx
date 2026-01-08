"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import clsx from "clsx";
import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
};

export default function DispatchPageShell({ title, subtitle, backHref, right, children }: Props) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/auth/login");
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {backHref ? (
                <Link href={backHref} className="rounded-full border px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">
                  ← Back
                </Link>
              ) : null}
              <h1 className="truncate text-xl font-semibold text-gray-900">{title}</h1>
            </div>
            {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
          </div>

          <div className="flex items-center gap-3">
            {right}
            <div className={clsx("hidden max-w-[260px] truncate text-sm text-gray-600 md:block", user ? "opacity-100" : "opacity-0")}>
              {user?.email}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:ring-4 focus:ring-gray-200 focus:outline-none">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
