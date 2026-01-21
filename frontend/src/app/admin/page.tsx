"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AdminRedirect = () => {
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  useEffect(() => {
    // Django admin 페이지로 리다이렉트
    window.location.href = `${API_BASE_URL}/admin`;
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <p>Django Admin 페이지로 이동 중...</p>
    </div>
  );
};

export default AdminRedirect;
