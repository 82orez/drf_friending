"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import MyProfile from "@/components/MyProfile";
import MainPage from "@/components/MainPage";

export default function Home() {
  const { user, loading, logout, updateProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // 로그인되지 않은 경우 리다이렉트 중이므로 아무것도 렌더링하지 않음
  if (!user) {
    return null;
  }

  return <div className="">{user && user.role == "teacher" ? <MyProfile /> : <MainPage />}</div>;
}
