"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminHome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && user.role === "teacher") router.push("/");
  }, [loading, user, router]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-xl font-semibold text-zinc-900">관리자 메뉴</div>
        <div className="mt-1 text-sm text-zinc-600">공고(CoursePost)와 강좌(Course)를 관리합니다.</div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Link href="/admin/dispatch-requests" className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50">
            <div className="text-sm font-semibold text-zinc-900">파견요청 관리</div>
            <div className="mt-1 text-sm text-zinc-600">매니저 요청 생성/목록/상세 확인</div>
          </Link>

          <Link href="/admin/posts" className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50">
            <div className="text-sm font-semibold text-zinc-900">공고 관리</div>
            <div className="mt-1 text-sm text-zinc-600">파견요청 기반 공고 생성/게시/지원자 관리</div>
          </Link>

          <Link href="/admin/courses" className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:bg-zinc-50">
            <div className="text-sm font-semibold text-zinc-900">강좌 관리</div>
            <div className="mt-1 text-sm text-zinc-600">확정 강좌 목록 및 상태 변경</div>
          </Link>

          <button
            onClick={() => window.open(`${API_BASE_URL}/admin/`, "_blank")}
            className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:bg-zinc-50">
            <div className="text-sm font-semibold text-zinc-900">Django Admin</div>
            <div className="mt-1 text-sm text-zinc-600">기존 Django admin 페이지 열기</div>
          </button>
        </div>
      </div>

      <div className={"mt-6 flex justify-center text-sm text-zinc-600"}>
        <Link href={"/"}>Back to Home</Link>
      </div>
    </div>
  );
}
