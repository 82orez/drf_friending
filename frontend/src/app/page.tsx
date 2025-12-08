"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function Home() {
  const { user, loading, logout, updateProfile } = useAuth();
  const router = useRouter();

  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string>("");

  // 프로필 이미지 관련 상태
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  useEffect(() => {
    // user 정보에 profile_image가 포함되어 있다면 초기값으로 사용
    if (user && (user as any).profile_image) {
      const imageUrl = (user as any).profile_image;
      // 상대 경로인 경우 백엔드 URL을 앞에 붙임
      if (imageUrl.startsWith("/media/")) {
        setProfileImageUrl(`${API_BASE_URL}${imageUrl}`);
      } else {
        setProfileImageUrl(imageUrl);
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleNavigation = (path: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    setIsNavigating(true);
    setNavigatingTo(path);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);

    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // ✅ 이미지 파일 타입(JPG/PNG) 검사
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["jpg", "jpeg", "png"];
    const allowedMimeTypes = ["image/jpeg", "image/png"];

    const isValidType = (ext && allowedExtensions.includes(ext)) || (file.type && allowedMimeTypes.includes(file.type));

    if (!isValidType) {
      setUploadError("JPG 또는 PNG 형식의 이미지 파일만 업로드할 수 있습니다.");
      setSelectedFile(null);
      setPreviewUrl(null);
      // 선택된 파일 초기화
      e.target.value = "";
      return;
    }

    // 간단한 용량 체크 (예: 2MB 제한)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError("이미지 크기는 2MB 이하여야 합니다.");
      setSelectedFile(null);
      setPreviewUrl(null);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);

    // 미리보기 URL 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append("profile_image", selectedFile);

      const data = await updateProfile(formData);

      // 업로드 성공 시 처리
      if (data.user && data.user.profile_image) {
        const imageUrl = data.user.profile_image;
        // 상대 경로인 경우 백엔드 URL을 앞에 붙임
        if (imageUrl.startsWith("/media/")) {
          setProfileImageUrl(`${API_BASE_URL}${imageUrl}`);
        } else {
          setProfileImageUrl(imageUrl);
        }
      }

      setPreviewUrl(null);
      setSelectedFile(null);
      setUploadSuccess("프로필 이미지가 성공적으로 업로드되었습니다.");

      // 파일 입력 초기화
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error: any) {
      console.error("Upload error:", error);

      if (error.response?.data?.detail) {
        setUploadError(error.response.data.detail);
      } else if (error.response?.data?.error) {
        setUploadError(error.response.data.error);
      } else {
        setUploadError("이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h1 className="mb-8 text-3xl font-bold text-gray-900">DRF Auth App</h1>

          {user ? (
            <div className="space-y-4">
              <div className="text-lg text-gray-700">Welcome!</div>
              <div className="text-sm text-gray-500">Email: {user.email}</div>
              <div className="text-sm text-gray-500">Email Verified: {user.is_email_verified ? "✅" : "❌"}</div>

              {/* === 프로필 이미지 영역 시작 === */}
              <div className="mt-6 border-t pt-6 text-left">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile Image</h2>

                <div className="flex items-start gap-4">
                  {/* 현재 프로필 이미지 / 미리보기 */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-24 w-24 overflow-hidden rounded-full bg-gray-100">
                      {/* previewUrl > profileImageUrl > 기본 이미지(anon-user.jpg) 순으로 사용 */}
                      <img src={previewUrl || profileImageUrl || "/anon-user.jpg"} alt="Profile" className="h-full w-full object-cover" />
                    </div>
                    <span className="text-xs text-gray-400">
                      {selectedFile ? selectedFile.name : profileImageUrl ? "현재 프로필 이미지" : "기본 프로필 이미지"}
                    </span>
                  </div>

                  {/* 업로드 컨트롤 */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">이미지 선택</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleFileChange}
                        className="mt-1 block w-full text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                      <p className="mt-1 text-xs text-gray-400">JPEG, JPG, PNG 이미지 파일만 업로드 가능 / 최대 2MB</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={uploading || !selectedFile}
                      className={`flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none ${
                        uploading || !selectedFile ? "cursor-not-allowed bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"
                      }`}>
                      {uploading ? "업로드 중..." : "프로필 이미지 업로드"}
                    </button>

                    {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}
                    {uploadSuccess && <p className="text-sm text-green-600">{uploadSuccess}</p>}
                  </div>
                </div>
              </div>
              {/* === 프로필 이미지 영역 끝 === */}

              <button
                onClick={handleLogout}
                className="mt-6 flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none">
                Logout
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-6 text-lg text-gray-700">Please sign in or create an account</div>
              <div className="space-y-3">
                <Link
                  href="/auth/login"
                  onClick={handleNavigation("/auth/login")}
                  className={`flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none ${
                    isNavigating && navigatingTo === "/auth/login" ? "cursor-not-allowed bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}>
                  {isNavigating && navigatingTo === "/auth/login" ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Loading...</span>
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </Link>

                <Link
                  href="/auth/register"
                  onClick={handleNavigation("/auth/register")}
                  className={`flex w-full justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none ${
                    isNavigating && navigatingTo === "/auth/register"
                      ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}>
                  {isNavigating && navigatingTo === "/auth/register" ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      <span>Loading...</span>
                    </div>
                  ) : (
                    "Create Account"
                  )}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
