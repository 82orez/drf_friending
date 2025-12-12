"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { teacherApplicationAPI } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function MyProfile() {
  const { user, loading, logout, updateProfile } = useAuth();
  const router = useRouter();

  // 프로필 이미지 관련 상태
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // 이력서 관련 상태 추가
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [loadingApplication, setLoadingApplication] = useState(false);

  // 이력서 삭제 관련 상태
  const [deletingApplication, setDeletingApplication] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

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

    // 이력서 상태 조회 추가
    if (user) {
      fetchApplicationStatus();
    }
  }, [user]);

  // 이력서 상태 조회 함수
  const fetchApplicationStatus = async () => {
    setLoadingApplication(true);
    try {
      const response = await teacherApplicationAPI.getMyApplication();
      if (response.data.success && response.data.data) {
        setApplicationStatus(response.data.data.status);
      }
    } catch (error: any) {
      // 이력서가 없는 경우 (404 에러)는 정상적인 상황
      if (error.response?.status !== 404) {
        console.error("Failed to fetch application status:", error);
      }
      setApplicationStatus(null);
    } finally {
      setLoadingApplication(false);
    }
  };

  const handleDeleteApplication = async () => {
    setDeleteError(null);
    setDeleteSuccess(null);

    const confirmed = window.confirm("불합격 처리된 이력서를 삭제하시겠습니까? (삭제 후 복구할 수 없습니다)");
    if (!confirmed) return;

    setDeletingApplication(true);
    try {
      const response = await teacherApplicationAPI.deleteMyApplication();
      const message = response.data?.message || "이력서가 삭제되었습니다.";

      setDeleteSuccess(message);
      setApplicationStatus(null);

      // 상태 다시 조회(혹시 서버에서 다른 응답이면 동기화)
      await fetchApplicationStatus();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.detail || "이력서 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.";
      setDeleteError(msg);
    } finally {
      setDeletingApplication(false);
    }
  };

  // 상태 값을 변환하는 함수
  const getStatusDisplay = (status: string | null) => {
    if (!status) return "No Application.";

    const statusMap: { [key: string]: string } = {
      NEW: "Submitted successfully!",
      IN_REVIEW: "Under Review!",
      ACCEPTED: "Accepted!",
      REJECTED: "Rejected!",
    };

    return statusMap[status] || status;
  };

  // 상태에 따른 색상 클래스 반환
  const getStatusColorClass = (status: string | null) => {
    if (!status) return "text-gray-500";

    const colorMap: { [key: string]: string } = {
      NEW: "text-blue-600",
      IN_REVIEW: "text-yellow-600",
      ACCEPTED: "text-green-600",
      REJECTED: "text-red-600",
    };

    return colorMap[status] || "text-gray-600";
  };

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

  const canShowDeleteButton = applicationStatus === "REJECTED" || applicationStatus === "REJECT";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h1 className="mb-8 text-3xl font-bold text-gray-900">My Profile</h1>

          <div className="space-y-4">
            <div className="text-lg text-gray-700">Welcome to Friending!</div>
            <div className="text-sm text-gray-500">Email: {user?.email}</div>
            <div className="text-sm text-gray-500">Email Verified: {user?.is_email_verified ? "✅" : "❌"}</div>

            <button
              onClick={handleLogout}
              className="mt-6 flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none">
              Logout
            </button>

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

            <div className={clsx("space-y-2")}>
              <div className="text-lg font-semibold text-gray-900">My Application Status</div>
              {loadingApplication ? (
                <div className="text-sm text-gray-400">상태 확인 중...</div>
              ) : (
                <div className={`rounded border p-2 font-medium ${getStatusColorClass(applicationStatus)}`}>
                  {getStatusDisplay(applicationStatus)}
                </div>
              )}
              {applicationStatus && (
                <button onClick={fetchApplicationStatus} className="text-xs text-indigo-600 underline hover:text-indigo-800">
                  Refresh
                </button>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push("/teacher/application")}
                className="w-full rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none">
                Fill out teacher application
              </button>
            </div>

            {/* === REJECTED 일 때만: 이력서 삭제 버튼 === */}
            {canShowDeleteButton && (
              <div className="mt-6 border-t pt-6 text-left">
                <div className="text-sm text-gray-600">불합격 처리된 이력서는 삭제 후 다시 새로 제출할 수 있습니다.</div>

                <button
                  type="button"
                  onClick={handleDeleteApplication}
                  disabled={deletingApplication}
                  className={`mt-3 w-full rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none ${
                    deletingApplication ? "cursor-not-allowed bg-red-300" : "bg-red-600 hover:bg-red-700"
                  }`}>
                  {deletingApplication ? "삭제 중..." : "이력서 삭제"}
                </button>

                {deleteError && <p className="mt-2 text-sm text-red-500">{deleteError}</p>}
                {deleteSuccess && <p className="mt-2 text-sm text-green-600">{deleteSuccess}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
